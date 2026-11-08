import { getPersonalSettings } from '../services/personalSettingsService.js';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { generateUuid, bufferToUuid } from '../utils/uuid.js';
import { normalizeBrazilianPhone, normalizeEmail } from '../utils/userData.js';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { sendPasswordChangedEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { requestPasswordReset, resetPassword as performPasswordReset } from '../services/passwordReset.js';
import { createSession } from '../services/sessionService.js';

const googleClient = new OAuth2Client();
const genericResetResponse = { message: 'Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.' };

async function issueToken(req, user, roles) {
  const sid = await createSession(req, user.id);
  return jwt.sign({ id: user.id.toString(), uuid: bufferToUuid(user.uuid), email: user.email, roles, sid }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

export const register = async (req, res) => {
  const { first_name, last_name, email, password, phone_number } = req.body;

  try {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizeBrazilianPhone(phone_number);
    const userExists = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (userExists) {
      return res.status(409).json({ message: 'E-mail já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          uuid: generateUuid(),
          firstName: first_name.trim(),
          lastName: last_name.trim(),
          email: normalizedEmail,
          passwordHash,
          phoneNumber: normalizedPhone
        }
      });
      const clientRole = await tx.role.upsert({
        where: { name: 'client' }, update: {}, create: { name: 'client' }
      });
      await tx.userRole.create({ data: { userId: created.id, roleId: clientRole.id } });
      return created;
    });

    res.status(201).json({
      uuid: bufferToUuid(user.uuid),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    });
  } catch (err) {
    if (err.message?.startsWith('Telefone inválido')) return res.status(400).json({ message: err.message });
    if (err.code === 'P2002') return res.status(409).json({ message: 'Número de telefone já cadastrado' });
    logger.error('register', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    if (user.deletedAt) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const roles = user.roles.map(ur => ur.role.name);

    const reactivated = !!user.deactivatedAt;
    if (reactivated) await prisma.user.update({ where: { id: user.id }, data: { deactivatedAt: null } });
    const token = await issueToken(req, user, roles);

    res.json({
      token,
      reactivated,
      user: {
        uuid: bufferToUuid(user.uuid),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        roles
      }
    });
  } catch (err) {
    logger.error('login', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const me = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store').json(await getPersonalSettings(BigInt(req.user.id)));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Não foi possível carregar sua conta.' });
  }
};

export const forgotPassword = (req, res) => {
  // A resposta sai antes de qualquer trabalho: o tempo de resposta não revela se o e-mail tem conta.
  res.json(genericResetResponse);
  requestPasswordReset(prisma, { email: normalizeEmail(req.body.email), frontendUrl: process.env.FRONTEND_URL, send: sendPasswordResetEmail })
    .catch((err) => logger.error(`forgotPassword: ${String(err?.message ?? err).slice(0, 220)}`, err));
};

export const resetPassword = async (req, res) => {
  try {
    const result = await performPasswordReset(prisma, {
      token: req.body.token, newPassword: req.body.newPassword, hash: (password) => bcrypt.hash(password, 10),
      notifyChanged: (user) => sendPasswordChangedEmail({ email: user.email, firstName: user.firstName }).catch((err) => logger.error(`passwordChangedEmail: ${String(err?.message ?? err).slice(0, 200)}`)),
    });
    if (!result.ok) return res.status(400).json({ message: 'Este link expirou ou já foi utilizado. Peça um novo link para continuar.' });
    res.json({ message: 'Senha redefinida com sucesso. Entre com a nova senha.' });
  } catch (err) { logger.error('resetPassword', err); res.status(500).json({ message: 'Não foi possível redefinir sua senha.' }); }
};

export const googleLogin = async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: 'Login com Google não está configurado.' });
    const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified || !payload.sub) return res.status(401).json({ message: 'A conta Google precisa ter e-mail verificado.' });
    const email = normalizeEmail(payload.email);
    let user = await prisma.user.findFirst({ where: { OR: [{ googleId: payload.sub }, { email }], deletedAt: null }, include: { roles: { include: { role: true } } } });
    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { uuid: generateUuid(), email, googleId: payload.sub, firstName: payload.given_name || payload.name || 'Usuário', lastName: payload.family_name || '', profilePictureUrl: payload.picture, isEmailVerified: true } });
        const role = await tx.role.upsert({ where: { name: 'client' }, update: {}, create: { name: 'client' } });
        await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
        return tx.user.findUnique({ where: { id: created.id }, include: { roles: { include: { role: true } } } });
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub, isEmailVerified: true }, include: { roles: { include: { role: true } } } });
    }
    const roles = user.roles.map((item) => item.role.name);
    if (user.deactivatedAt) await prisma.user.update({ where: { id: user.id }, data: { deactivatedAt: null } });
    const token = await issueToken(req, user, roles);
    res.json({ token, reactivated: !!user.deactivatedAt, user: { uuid: bufferToUuid(user.uuid), firstName: user.firstName, lastName: user.lastName, email: user.email, profilePictureUrl: user.profilePictureUrl, roles } });
  } catch (err) { logger.error('googleLogin', err); res.status(401).json({ message: 'Não foi possível entrar com o Google.' }); }
};
