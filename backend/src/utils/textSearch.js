/**
 * Busca por trecho de texto. O `contains` do Prisma gera LIKE CONCAT('%', ?, '%'), e no MySQL da hospedagem isso falha com
 * "Illegal mix of collations" (o parâmetro chega como binário). Aqui o padrão é montado em JavaScript e passado inteiro
 * como parâmetro de um LIKE, o que funciona. Cada função devolve ids para usar em `{ id: { in: ids } }`.
 */
const LIMIT = 5000;

const BACKSLASH = String.fromCharCode(92);
const escapeChar = (char) => (char === '%' || char === '_' || char === BACKSLASH ? BACKSLASH + char : char);

/** "%termo%", com %, _ e a barra invertida do próprio termo tratados como texto comum. */
export const likePattern = (term) => `%${Array.from(String(term), escapeChar).join('')}%`;

export async function listingIdsMatching(db, term) {
  const pattern = likePattern(term);
  const rows = await db.$queryRaw`SELECT id FROM listings WHERE title LIKE ${pattern} OR description LIKE ${pattern} LIMIT ${LIMIT}`;
  return rows.map((row) => row.id);
}

export async function reviewIdsMatching(db, reviewedId, term) {
  const pattern = likePattern(term);
  const rows = await db.$queryRaw`SELECT id FROM reviews WHERE reviewed_id = ${reviewedId} AND comment LIKE ${pattern} LIMIT ${LIMIT}`;
  return rows.map((row) => row.id);
}

/** Conversas do usuário cujo título, prévia ou nome do outro participante contém o termo. */
export async function conversationIdsMatching(db, userId, term) {
  const pattern = likePattern(term);
  const rows = await db.$queryRaw`
    SELECT c.id FROM conversations c
    JOIN users cl ON cl.id = c.client_id
    JOIN users pr ON pr.id = c.professional_id
    WHERE (c.client_id = ${userId} OR c.professional_id = ${userId})
      AND (c.title LIKE ${pattern} OR c.last_message_preview LIKE ${pattern}
        OR cl.first_name LIKE ${pattern} OR cl.last_name LIKE ${pattern} OR pr.first_name LIKE ${pattern} OR pr.last_name LIKE ${pattern})
    LIMIT ${LIMIT}`;
  return rows.map((row) => row.id);
}
