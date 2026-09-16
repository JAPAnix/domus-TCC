import { randomInt, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { accountError, lockAccount } from './personalSettingsService.js';
import { sendEmailVerification } from './emailService.js';
import { sendVerificationCode } from './smsService.js';

function hashCode(id, code) {
  if (!process.env.JWT_SECRET) throw accountError(503, 'Confirmação indisponível.');
  return createHmac('sha256', process.env.JWT_SECRET).update(`dommos-contact:${id}:${code}`).digest('hex');
}
async function checkUnique(tx, userId, type, target) {
  const where = type === 'email' ? { email: target } : { phoneNumber: { in: [target, ...(target.startsWith('+55') ? [target.slice(3)] : [])] } };
  if (await tx.user.findFirst({ where: { ...where, NOT: { id: userId } }, select: { id: true } })) throw accountError(409, type === 'email' ? 'Este email já está associado a outra conta.' : 'Este telefone já está associado a outra conta.');
}
export async function requestContactCode(userId, type, target) {
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const id = randomUUID();
  const now = new Date();
  const record = await prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    await checkUnique(tx, userId, type, target);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (type === 'email' && user.email === target && user.isEmailVerified) throw accountError(422, 'Este email já está confirmado.');
    if (type === 'phone' && user.phoneNumber === target && user.isPhoneVerified) throw accountError(422, 'Este telefone já está confirmado.');
    const recent = await tx.contactVerification.findFirst({ where: { userId, type }, orderBy: { createdAt: 'desc' } });
    if (recent && now - recent.createdAt < 60000) throw accountError(429, 'Aguarde 60 segundos entre envios.');
    const since = new Date(now.getTime() - 3600000);
    const count = await tx.contactVerification.count({ where: { userId, type, createdAt: { gte: since } } });
    const targets = await tx.contactVerification.count({ where: { target, createdAt: { gte: since } } });
    if (count >= 5 || targets >= 10) throw accountError(429, 'Limite de envios atingido. Tente novamente em uma hora.');
    await tx.contactVerification.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } });
    return tx.contactVerification.create({ data: { id, userId, type, target, codeHash: hashCode(id, code), expiresAt: new Date(now.getTime() + 600000) } });
  });
  try {
    const result = type === 'email' ? await sendEmailVerification({ email: target, code }) : await sendVerificationCode(target, code);
    const updated = await prisma.contactVerification.updateMany({ where: { id, usedAt: null }, data: { deliveredAt: new Date() } });
    if (!updated.count) throw accountError(409, 'Esta solicitação foi cancelada.');
    return { delivery: result.delivery, expiresAt: record.expiresAt, resendAt: new Date(record.createdAt.getTime() + 60000) };
  } catch (err) {
    await prisma.contactVerification.updateMany({ where: { id }, data: { usedAt: new Date() } });
    throw err.status ? err : accountError(502, type === 'email' ? 'Não foi possível enviar o email.' : 'Não foi possível enviar o SMS.');
  }
}
export async function confirmContactCode(userId, type, code) {
  const result = await prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const record = await tx.contactVerification.findFirst({ where: { userId, type, usedAt: null, deliveredAt: { not: null } }, orderBy: { createdAt: 'desc' } });
    if (!record) return { status: 400, message: 'Não há confirmação pendente. Solicite outro código.' };
    if (record.expiresAt <= new Date()) return { status: 400, message: 'O código expirou. Solicite outro.' };
    if (record.attempts >= 5) return { status: 429, message: 'Limite de tentativas atingido. Solicite outro código.' };
    if (!timingSafeEqual(Buffer.from(record.codeHash, 'hex'), Buffer.from(hashCode(record.id, code), 'hex'))) {
      await tx.contactVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      return { status: 400, message: 'O código informado é inválido.' };
    }
    await checkUnique(tx, userId, type, record.target);
    await tx.user.update({ where: { id: userId }, data: type === 'email' ? { email: record.target, isEmailVerified: true } : { phoneNumber: record.target, isPhoneVerified: true } });
    await tx.contactVerification.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    if (type === 'email') await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    return null;
  });
  if (result) throw accountError(result.status, result.message);
}
export async function cancelContactCode(userId, type) {
  await prisma.$transaction(async (tx) => { await lockAccount(tx, userId); await tx.contactVerification.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }); });
}
