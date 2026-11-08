import crypto from 'node:crypto';

/** Validade do link: curta, porque quem pede costuma usar na hora. */
export const RESET_TTL_MS = 30 * 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * Pede um link de redefinição. Se não existir conta com o e-mail, não faz nada (e quem chama responde igual de qualquer jeito).
 * O token vai por e-mail em texto; no banco fica só o hash, e links anteriores deixam de valer.
 * `send({ email, link, hasPassword })` entrega o e-mail; `hasPassword` é falso para quem criou a conta só com o Google.
 */
export async function requestPasswordReset(db, { email, frontendUrl, send, now = new Date(), randomToken = () => crypto.randomBytes(32).toString('hex') }) {
  const user = await db.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) return { sent: false };
  const token = randomToken();
  await db.$transaction([
    db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
    db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + RESET_TTL_MS) } }),
  ]);
  await send({ email: user.email, link: `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`, hasPassword: !!user.passwordHash });
  return { sent: true };
}

/**
 * Troca a senha com o token do e-mail. Uso único: o token e todos os outros pendentes da pessoa são invalidados,
 * e todas as sessões abertas são encerradas (quem estiver logado em outro aparelho precisa entrar de novo).
 * `notifyChanged({ email, firstName })` avisa por e-mail que a senha mudou.
 */
export async function resetPassword(db, { token, newPassword, hash, notifyChanged, now = new Date() }) {
  const reset = await db.passwordResetToken.findFirst({ where: { tokenHash: sha256(token), usedAt: null, expiresAt: { gt: now } } });
  if (!reset) return { ok: false };
  // Uso único de verdade: quem "consome" o token primeiro vence, mesmo com dois cliques ao mesmo tempo.
  const claimed = await db.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  if (claimed.count !== 1) return { ok: false };
  const passwordHash = await hash(newPassword);
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    db.passwordResetToken.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } }),
    db.userSession.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: now } }),
  ]);
  const user = await db.user.findFirst({ where: { id: reset.userId }, select: { email: true, firstName: true } });
  if (user) await notifyChanged?.(user);
  return { ok: true };
}
