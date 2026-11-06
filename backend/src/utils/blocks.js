/** Há bloqueio em qualquer direção entre os dois usuários? */
export async function isBlockedBetween(db, a, b) {
  const block = await db.userBlock.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { blockerId: true },
  });
  return !!block;
}

/** Ids de quem bloqueou o usuário ou foi bloqueado por ele. */
export async function blockedIds(db, userId) {
  const rows = await db.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return [...new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)))];
}

/** Filtro de usuário que pode aparecer em listagens públicas (ativo e que aceita aparecer na busca). */
export const publiclyListedUser = {
  deletedAt: null,
  deactivatedAt: null,
  OR: [{ settings: { is: null } }, { settings: { is: { searchIndexing: true } } }],
};
