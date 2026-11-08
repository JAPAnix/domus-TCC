import { generateUuid } from '../utils/uuid.js';
import { platformFeePercent } from './platformFee.js';
import { syncPaymentsWithOrder } from './paymentWorkflow.js';

/**
 * Quando o cliente aceita uma proposta, nasce uma contratação (Order) ligada ao pedido aberto e à proposta.
 * É ela que recebe o pagamento, o recibo, os ganhos e o reembolso: o mesmo caminho dos serviços contratados por anúncio.
 */
export async function createOrderForProposal(tx, { service, proposal }) {
  const today = new Date();
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const now = new Date();
  return tx.order.create({
    data: {
      uuid: generateUuid(), listingId: null, serviceId: service.id, proposalId: proposal.id,
      clientId: service.clientId, professionalId: proposal.professionalId, status: 'accepted', acceptedAt: now,
      scheduledDate: service.deadline && service.deadline > day ? service.deadline : day,
      serviceMode: 'negotiated', origin: 'pedido_aberto', note: proposal.coverLetter ? proposal.coverLetter.slice(0, 1000) : null,
      titleSnapshot: String(service.title).slice(0, 120), pricingModelSnapshot: 'fixed',
      priceSnapshot: proposal.proposedPrice, policySnapshot: 'moderate', platformFeePercent: platformFeePercent(),
    },
  });
}

async function lockedByService(tx, serviceId) {
  await tx.$queryRaw`SELECT id FROM orders WHERE service_id = ${serviceId} FOR UPDATE`;
  return tx.order.findUnique({ where: { serviceId } });
}

/** O cliente concluiu o pedido aberto: a contratação também termina, com o valor da proposta. */
export async function completeOrderForService(tx, serviceId) {
  const order = await lockedByService(tx, serviceId);
  if (!order || !['accepted', 'in_progress'].includes(order.status)) return null;
  const now = new Date();
  const amount = Number(order.priceSnapshot);
  await tx.order.update({ where: { id: order.id }, data: { status: 'completed', completedAt: now, startedAt: order.startedAt ?? now, finalAmount: amount } });
  await syncPaymentsWithOrder(tx, order, 'completed', amount);
  return order;
}

/** O pedido aberto foi cancelado: a contratação também. Quem quiser estornar chama refundOnCancel depois do commit. */
export async function cancelOrderForService(tx, serviceId, userId) {
  const order = await lockedByService(tx, serviceId);
  if (!order || !['accepted', 'in_progress'].includes(order.status)) return null;
  await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled', cancelledAt: new Date(), cancelledById: userId } });
  await syncPaymentsWithOrder(tx, order, 'cancelled', null);
  return order;
}
