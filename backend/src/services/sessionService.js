import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function deviceLabel(userAgent = '') {
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /OPR\//.test(userAgent) ? 'Opera' : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Navegador';
  const system = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Mac OS/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : 'sistema desconhecido';
  return `${browser} em ${system}`;
}

/** Mostra só o começo do IP: o suficiente para reconhecer a rede sem expor o endereço inteiro. */
export function maskIp(ip = '') {
  const clean = ip.replace(/^::ffff:/, '');
  if (clean.includes('.')) return `${clean.split('.').slice(0, 2).join('.')}.•.•`;
  if (clean.includes(':')) return `${clean.split(':').slice(0, 2).join(':')}:•••`;
  return 'desconhecido';
}

export async function createSession(req, userId) {
  const id = randomUUID();
  await prisma.userSession.create({
    data: {
      id,
      userId,
      userAgent: (req.get('user-agent') ?? '').slice(0, 300) || null,
      ip: (req.ip ?? '').slice(0, 64) || null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  // Limpeza de sessões antigas do mesmo usuário, para a tabela não crescer sem fim.
  await prisma.userSession.deleteMany({ where: { userId, expiresAt: { lt: new Date(Date.now() - 30 * SESSION_TTL_MS) } } });
  return id;
}

export function revokeSessions(db, userId, exceptId) {
  return db.userSession.updateMany({
    where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { revokedAt: new Date() },
  });
}
