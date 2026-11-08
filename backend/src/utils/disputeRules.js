const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

/**
 * Valida a decisão do administrador sobre uma reclamação.
 * - "release": mantém o pagamento ao profissional.
 * - "refund": devolve ao cliente. Sem valor, é o total; com valor menor que o total, é reembolso parcial
 *   (o cliente recebe aquela parte e o restante é liberado ao profissional).
 * A justificativa é obrigatória: as duas partes recebem a decisão e ela fica no registro de auditoria.
 */
export function parseResolution({ decision, note, refundCents } = {}, { amountCents } = {}) {
  if (!['release', 'refund'].includes(decision)) fail(400, 'Escolha reembolsar o cliente ou manter o pagamento ao profissional.');
  const text = String(note ?? '').trim();
  if (text.length < 10 || text.length > 500) fail(400, 'Escreva a justificativa da decisão, de 10 a 500 caracteres.');
  if (decision === 'release') return { kind: 'release', note: text, refundCents: 0 };
  if (refundCents == null || refundCents === '') return { kind: 'refund', note: text, refundCents: amountCents };
  const cents = Number(refundCents);
  if (!Number.isInteger(cents) || cents < 1) fail(400, 'Informe o valor do reembolso em reais, maior que zero.');
  if (cents > amountCents) fail(400, 'O reembolso não pode ser maior que o valor pago.');
  return { kind: cents === amountCents ? 'refund' : 'partial', note: text, refundCents: cents };
}

/** Há quantos dias a reclamação está aberta (dias inteiros). */
export function daysOpen(createdAt, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86400000));
}
