// Dinheiro sempre em centavos inteiros. Nada de ponto flutuante em conta de valor.
// Arredondamento: "meio para cima" (0,5 centavo sobe), aplicado uma vez por item.

/** Converte reais (número, texto "12,34" ou Decimal do Prisma) em centavos inteiros. */
export function toCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = typeof value === 'string' ? value.trim().replace(/\./g, '').replace(',', '.') : String(value);
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error('Valor inválido.');
  return Math.round((Math.abs(number) + Number.EPSILON) * 100) * (number < 0 ? -1 : 1);
}

export const fromCents = (cents) => cents / 100;

/** "R$ 1.234,56" a partir de centavos. */
export const formatCents = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Pontos-base (1% = 100) de um percentual com até 2 casas, sem erro de ponto flutuante. */
const basisPoints = (percent) => Math.round(Number(percent) * 100);

/** Percentual de um valor em centavos, arredondado meio para cima. Ex.: 10% de 12345 = 1235. */
export function percentOf(cents, percent) {
  if (!Number.isInteger(cents) || cents < 0) throw new Error('Os centavos precisam ser um inteiro não negativo.');
  return Math.floor((cents * basisPoints(percent) + 5000) / 10000);
}

/**
 * Quanto cada parte recebe de um serviço.
 * @param serviceCents valor do serviço (preço mais deslocamento)
 * @param clientFeePercent taxa de serviço cobrada do cliente, somada ao total
 * @param proCommissionPercent comissão descontada do profissional
 */
export function computeCheckout({ serviceCents, clientFeePercent, proCommissionPercent }) {
  const clientFeeCents = percentOf(serviceCents, clientFeePercent);
  const commissionCents = percentOf(serviceCents, proCommissionPercent);
  return {
    serviceCents,
    clientFeeCents,
    totalCents: serviceCents + clientFeeCents, // o que o cliente paga
    commissionCents,
    proGrossCents: serviceCents - commissionCents, // parte do profissional antes da taxa do gateway
    platformGrossCents: clientFeeCents + commissionCents, // parte da plataforma antes da taxa do gateway
  };
}

/**
 * Divide o valor líquido (netValue: total menos a taxa do gateway) entre profissional e plataforma.
 * Sempre vale: proShareCents + platformShareCents === netCents.
 * - payer "professional": a plataforma fica com a sua parte cheia e o profissional absorve a taxa do gateway.
 * - payer "platform": o profissional fica com a parte cheia e a plataforma absorve a taxa do gateway.
 */
export function splitNet({ netCents, proGrossCents, platformGrossCents, gatewayFeePayer }) {
  if (!Number.isInteger(netCents) || netCents < 0) throw new Error('Valor líquido inválido.');
  const proShareCents = gatewayFeePayer === 'platform'
    ? Math.min(proGrossCents, netCents)
    : Math.max(0, netCents - platformGrossCents);
  return { proShareCents, platformShareCents: netCents - proShareCents };
}

/** Reembolso conforme a política de cancelamento: horas até o serviço decidem se é total ou parcial. */
export const REFUND_POLICIES = {
  flexible: { fullUntilHours: 24, partialPercent: 50 },
  moderate: { fullUntilHours: 72, partialPercent: 50 },
  strict: { fullUntilHours: 168, partialPercent: 0 },
};

/**
 * Valor a devolver ao cliente quando ELE cancela. Se o profissional cancela, o reembolso é sempre total.
 * `hoursUntilService` é negativo se o serviço já passou.
 */
export function refundCents({ totalCents, policy, hoursUntilService, canceledBy }) {
  if (canceledBy === 'professional') return totalCents;
  const rule = REFUND_POLICIES[policy] ?? REFUND_POLICIES.moderate;
  if (hoursUntilService >= rule.fullUntilHours) return totalCents;
  if (hoursUntilService > 0) return percentOf(totalCents, rule.partialPercent);
  return 0;
}
