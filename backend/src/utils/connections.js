/**
 * Conexões: pessoas com quem o usuário já fechou negócio (proposta aceita).
 * Retorna Map<idComoTexto, { id, count, last }>.
 */
export async function connectionMap(db, userId) {
  const map = new Map();
  const add = (id, date) => {
    const key = id.toString();
    const current = map.get(key) ?? { id, count: 0, last: date };
    current.count += 1;
    if (date > current.last) current.last = date;
    map.set(key, current);
  };

  const proposals = await db.proposal.findMany({
    where: {
      status: 'accepted',
      OR: [
        { professionalId: userId, service: { deletedAt: null } },
        { service: { clientId: userId, deletedAt: null } },
      ],
    },
    select: { professionalId: true, updatedAt: true, service: { select: { clientId: true } } },
  });
  for (const proposal of proposals) add(proposal.professionalId === userId ? proposal.service.clientId : proposal.professionalId, proposal.updatedAt);

  for (const extra of connectionSources) await extra(db, userId, add);
  return map;
}

// Outras origens de conexão (ex.: contratações de anúncios) se registram aqui.
const connectionSources = [];
export function registerConnectionSource(source) {
  connectionSources.push(source);
}

export async function areConnected(db, a, b) {
  return (await connectionMap(db, a)).has(b.toString());
}
