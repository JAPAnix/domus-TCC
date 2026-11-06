// Regras dos pagamentos, sem acesso a banco: fáceis de testar.
import { unitsTotal } from './bookingSlots.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export const PAYMENT_METHODS = { pix: 'Pix', cash: 'Dinheiro', card_in_person: 'Cartão na maquininha, presencialmente' };
export const PAYMENT_STATUS_LABELS = {
  pending: 'Aguardando pagamento', reported: 'Aguardando confirmação do profissional', confirmed: 'Pagamento confirmado', cancelled: 'Cancelado', refunded: 'Estornado',
};

// Quem pode fazer cada ação e de qual status ela parte.
// "manualOnly": com um provedor automático (Mercado Pago), o status vem do provedor e não de cliques.
export const PAYMENT_ACTIONS = {
  report: { from: ['pending'], to: 'reported', who: ['client'], manualOnly: true },
  confirm: { from: ['pending', 'reported'], to: 'confirmed', who: ['professional'], manualOnly: true },
  reject: { from: ['reported'], to: 'pending', who: ['professional'], manualOnly: true },
  cancel: { from: ['pending', 'reported'], to: 'cancelled', who: ['client', 'professional'], manualOnly: false },
  refund: { from: ['confirmed'], to: 'refunded', who: ['professional'], manualOnly: false },
};

export const ORDER_STATUSES_THAT_ALLOW_PAYMENT = ['accepted', 'in_progress', 'completed'];
export const ACTIVE_PAYMENT_STATUSES = ['pending', 'reported', 'confirmed'];

export function paymentRole(payment, userId) {
  if (payment.clientId === userId) return 'client';
  if (payment.professionalId === userId) return 'professional';
  return null;
}

/** Valor a pagar: o valor final informado na conclusão, ou o preço fixo do anúncio (com deslocamento). */
export function amountDue(order) {
  if (order.finalAmount != null) return Math.round(Number(order.finalAmount) * 100) / 100;
  if (order.pricingModelSnapshot === 'fixed' && order.priceSnapshot != null) {
    return Math.round((Number(order.priceSnapshot) + Number(order.travelFeeSnapshot ?? 0)) * 100) / 100;
  }
  // Por hora e por diária, o total já é conhecido na contratação: valor x quantidade (mais deslocamento).
  if (order.quantity) return unitsTotal(order.pricingModelSnapshot, order.priceSnapshot, order.quantity, order.travelFeeSnapshot);
  return null;
}

export function resolvePaymentAction(payment, userId, action, { manual = true } = {}) {
  const rule = PAYMENT_ACTIONS[action];
  if (!rule) fail(404, 'Ação não encontrada.');
  const role = paymentRole(payment, userId);
  if (!role) fail(404, 'Pagamento não encontrado.');
  if (!rule.who.includes(role)) fail(403, 'Esta ação não está disponível para você.');
  if (rule.manualOnly && !manual) fail(409, 'Este pagamento é confirmado automaticamente pelo provedor.');
  if (!rule.from.includes(payment.status)) fail(409, 'O pagamento já foi atualizado. Recarregue a página.');
  return { to: rule.to, role };
}

export function availablePaymentActions(payment, userId, options) {
  return Object.keys(PAYMENT_ACTIONS).filter((action) => {
    try { resolvePaymentAction(payment, userId, action, options); return true; } catch { return false; }
  });
}

export const parseAcceptedMethods = (value) => String(value ?? 'pix').split(',').map((item) => item.trim()).filter((item) => item in PAYMENT_METHODS);
