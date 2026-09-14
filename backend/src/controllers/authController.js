import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { generateUuid, bufferToUuid } from '../utils/uuid.js';
import { normalizeBrazilianPhone, normalizeEmail } from '../utils/userData.js';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { sendPasswordResetEmail } from '../services/emailService.js';

const googleClient = new OAuth2Client();
const genericResetResponse = { message: 'Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.' };

function createToken(user, roles) {
  return jwt.sign({ id: user.id.toString(), uuid: bufferToUuid(user.uuid), email: user.email, roles }, process.env.JWT_SECRET, { expiresIn: '1d' });
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

    const token = createToken(user, roles);

    res.json({
      token,
      user: {
        uuid: bufferToUuid(user.uuid),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
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
    const user = await prisma.user.findUnique({
      where: { id: BigInt(req.user.id) },
      include: {
        roles: {
          include: { role: true }
        },
        professionalProfile: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
  uuid: bufferToUuid(user.uuid),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  profilePictureUrl: user.profilePictureUrl,
  isEmailVerified: user.isEmailVerified,
  roles: user.roles.map(ur => ur.role.name),
  hasProfessionalProfile: !!user.professionalProfile,
  zipCode: user.zipCode,
  street: user.street,
  number: user.number,
  complement: user.complement,
  neighborhood: user.neighborhood,
  city: user.city,
  state: user.state
});
  } catch (err) {
    logger.error('me', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const user = await prisma.user.findFirst({ where: { email: normalizeEmail(req.body.email), deletedAt: null } });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
        prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } })
      ]);
      await sendPasswordResetEmail({ email: user.email, link: `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}` });
    }
  } catch (err) { logger.error('forgotPassword', err); }
  res.json(genericResetResponse);
};

export const resetPassword = async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const reset = await prisma.passwordResetToken.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } } });
    if (!reset) return res.status(400).json({ message: 'Este link expirou ou já foi utilizado. Solicite um novo.' });
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await bcrypt.hash(req.body.newPassword, 10) } }),
      prisma.passwordResetToken.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } })
    ]);
    res.json({ message: 'Senha redefinida com sucesso.' });
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
    res.json({ token: createToken(user, roles), user: { uuid: bufferToUuid(user.uuid), firstName: user.firstName, lastName: user.lastName, email: user.email, roles } });
  } catch (err) { logger.error('googleLogin', err); res.status(401).json({ message: 'Não foi possível entrar com o Google.' }); }
};
