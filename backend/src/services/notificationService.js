// Notificações lidas e não lidas. O estado fica no banco, por usuário: aparece igual em qualquer aba ou aparelho.
const MAX_IDS = 100;

/** Converte a lista recebida em ids válidos (números inteiros positivos, sem repetição, no máximo 100). */
export function parseIds(value) {
  if (!Array.isArray(value)) return null;
  const ids = [];
  for (const item of value) {
    const text = String(item);
    if (!/^[1-9][0-9]{0,18}$/.test(text)) return null;
    ids.push(BigInt(text));
  }
  const unique = [...new Set(ids.map((id) => id.toString()))].map((id) => BigInt(id));
  return unique.length && unique.length <= MAX_IDS ? unique : null;
}

export const unreadCount = (db, userId) => db.notification.count({ where: { userId, readAt: null } });

/** Marca como lidas só as notificações DO usuário; ids de outras pessoas são ignorados sem erro nem pista. */
export async function markRead(db, userId, ids) {
  await db.notification.updateMany({ where: { userId, id: { in: ids }, readAt: null }, data: { readAt: new Date() } });
  return unreadCount(db, userId);
}

export async function markAllRead(db, userId) {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return unreadCount(db, userId);
}
