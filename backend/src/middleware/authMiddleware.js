import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

// Valida o token e confere se a sessão ainda está ativa no banco (permite encerrar sessões à distância).
export async function authenticateToken(token) {
  if (!token) return { error: 'Token não fornecido' };

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { error: 'Token inválido ou expirado' };
  }
  if (!decoded.sid) return { error: 'Sua sessão precisa ser renovada. Entre novamente.' };

  const session = await prisma.userSession.findUnique({
    where: { id: decoded.sid },
    select: { userId: true, revokedAt: true, expiresAt: true, lastSeenAt: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.userId.toString() !== String(decoded.id)) {
    return { error: 'Esta sessão foi encerrada. Entre novamente.' };
  }
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    prisma.userSession.update({ where: { id: decoded.sid }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return { user: decoded };
}

const resolveUser = (req) => authenticateToken(req.headers.authorization?.split(' ')[1]); // Bearer <token>

const authMiddleware = async (req, res, next) => {
  const { user, error } = await resolveUser(req);
  if (error) return res.status(401).json({ message: error });
  req.user = user;
  next();
};

/** Identifica o usuário quando há token válido, mas não recusa visitantes. */
export const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization) {
    const { user } = await resolveUser(req);
    if (user) req.user = user;
  }
  next();
};

export default authMiddleware;
