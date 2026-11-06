// Traduz eventos do Asaas em mudanças de estado do pagamento. Funções puras: ficam fáceis de testar e não mexem no banco.
// Quem aplica o resultado (e confere idempotência) é services/asaasWebhook.js.
import { mapAccountStatus } from '../services/payments/asaasProvider.js';

/** Quais mudanças de estado são válidas. O que não está aqui é ignorado e registrado. */
export const PAYMENT_TRANSITIONS = {
  pending: ['confirmed', 'expired', 'refused', 'cancelled'],
  expired: ['confirmed', 'cancelled'],
  refused: ['confirmed', 'cancelled'],
  confirmed: ['refunded', 'disputed', 'chargeback'],
  disputed: ['confirmed', 'refunded', 'chargeback'],
  chargeback: ['refunded'],
  cancelled: [],
  refunded: [],
  reported: ['confirmed', 'cancelled'],
};

export const canTransition = (from, to) => (PAYMENT_TRANSITIONS[from] ?? []).includes(to);

const TARGET = {
  PAYMENT_CONFIRMED: 'confirmed',
  PAYMENT_RECEIVED: 'confirmed',
  PAYMENT_OVERDUE: 'expired',
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: 'refused',
  PAYMENT_CREDIT_CARD_INVALID: 'refused',
  PAYMENT_DELETED: 'cancelled',
  PAYMENT_REFUNDED: 'refunded',
  PAYMENT_CHARGEBACK_REQUESTED: 'chargeback',
  PAYMENT_CHARGEBACK_DISPUTE: 'chargeback',
};

/**
 * Decide o que fazer com um evento de cobrança.
 * @param event corpo do webhook ({ id, event, payment: { id, ... } })
 * @param payment linha do nosso banco ({ status, payoutStatus, escrowEnabled })
 * @returns { action: 'ignore', reason } | { action: 'apply', to?, patch, notice?, alert? }
 */
export function planPaymentEvent(event, payment, { escrowEnabled = false, now = new Date() } = {}) {
  const name = event?.event;
  // Divisão (split) e reembolso parcial não mudam o estado, só o repasse ou o registro.
  if (name === 'PAYMENT_SPLIT_DONE') {
    if (!['confirmed', 'disputed'].includes(payment.status)) return { action: 'ignore', reason: 'split_fora_de_estado' };
    // Com garantia ligada, "split concluído" não significa dinheiro disponível: a liberação é pelo encerramento da garantia.
    if (escrowEnabled || payment.payoutStatus === 'released') return { action: 'ignore', reason: 'split_com_garantia' };
    return { action: 'apply', patch: { payoutStatus: 'released', releasedAt: now }, notice: 'split_done' };
  }
  if (name === 'PAYMENT_SPLIT_CANCELLED' || name === 'PAYMENT_SPLIT_DIVERGENCE_BLOCK' || name === 'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED') {
    return { action: 'apply', patch: {}, alert: 'split_problem' };
  }
  if (name === 'PAYMENT_PARTIALLY_REFUNDED') return { action: 'apply', patch: {}, notice: 'partial_refund' };

  const to = TARGET[name];
  if (!to) return { action: 'ignore', reason: 'evento_desconhecido' };
  if (payment.status === to) return { action: 'ignore', reason: 'sem_mudanca' };
  if (!canTransition(payment.status, to)) {
    // Dinheiro recebido por uma cobrança que nós já tínhamos cancelado ou estornado precisa de olhar humano.
    if (to === 'confirmed' && ['cancelled', 'refunded'].includes(payment.status)) return { action: 'ignore', reason: 'estado_final', alert: 'paid_after_close' };
    return { action: 'ignore', reason: 'transicao_invalida' };
  }
  const patch = { status: to };
  if (to === 'confirmed') Object.assign(patch, { confirmedAt: now, payoutStatus: 'held' });
  if (to === 'refunded') Object.assign(patch, { refundedAt: now, payoutStatus: 'refunded', ...(payment.amountCents != null && { refundedCents: payment.amountCents }) });
  if (to === 'cancelled') patch.cancelledAt = now;
  return { action: 'apply', to, patch, notice: to, ...(to === 'chargeback' && { alert: 'chargeback' }) };
}

/** Eventos de situação da conta de recebimento (ACCOUNT_STATUS_*). */
export function planAccountEvent(event) {
  if (!String(event?.event ?? '').startsWith('ACCOUNT_STATUS_') || !event.accountStatus) return { action: 'ignore', reason: 'evento_desconhecido' };
  const status = mapAccountStatus(event.accountStatus);
  const detail = { commercialInfo: event.accountStatus.commercialInfo, bankAccountInfo: event.accountStatus.bankAccountInfo, documentation: event.accountStatus.documentation, general: event.accountStatus.general };
  return { action: 'apply', status, detail, rejectionReason: status === 'rejected' ? rejectionText(detail) : null };
}

/** Texto para o profissional saber o que corrigir, a partir do que o Asaas reprovou. */
export function rejectionText(detail) {
  const parts = [];
  if (detail.documentation === 'REJECTED') parts.push('os documentos enviados foram recusados (envie de novo, com boa qualidade)');
  if (detail.bankAccountInfo === 'REJECTED') parts.push('os dados bancários foram recusados (confira banco, agência, conta e titularidade)');
  if (detail.commercialInfo === 'REJECTED') parts.push('os dados cadastrais foram recusados (confira nome, documento, endereço e renda)');
  return parts.length ? `O gateway informou que ${parts.join('; ')}.` : 'O gateway recusou o cadastro. Confira os dados e tente de novo.';
}

/** Estados em que o dinheiro do cliente ainda pode ser devolvido por nós. */
export const REFUNDABLE = ['confirmed', 'disputed'];
