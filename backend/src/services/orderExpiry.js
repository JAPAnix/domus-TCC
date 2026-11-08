import { prisma } from '../config/prisma.js';
import { runTransaction, notify } from './serviceWorkflow.js';
import { bufferToUuid } from '../utils/uuid.js';
import { planExpiry, WARN_BEFORE_HOURS } from '../utils/orderRules.js';
import { expireOrder } from './orderWorkflow.js';
import { logger } from '../utils/logger.js';

const HOUR = 3600000;
const rowSelect = { id: true, status: true, expiresAt: true, proposalValidUntil: true };

/**
 * Uma passada da rotina: avisa quem está perto de perder o prazo e expira o que venceu.
 * Pedido novo sem resposta e proposta sem decisão expiram; os avisos saem uma vez só (eventKey único).
 * `db` e `now` são parâmetros para os testes.
 */
export async function runOrderExpiry(now = new Date(), db = prisma) {
  const horizon = new Date(now.getTime() + WARN_BEFORE_HOURS * HOUR);
  const rows = await db.order.findMany({
    where: { OR: [{ status: 'requested', expiresAt: { lte: horizon } }, { status: 'proposed', proposalValidUntil: { lte: horizon } }] },
    select: rowSelect, take: 500,
  });
  const { toExpire, toWarn } = planExpiry(rows, now);
  let expired = 0, warned = 0;
  for (const id of toExpire) {
    try {
      const done = await runTransaction(async (tx, emails) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`;
        const order = await tx.order.findFirst({ where: { id } });
        // Alguém pode ter respondido entre a consulta e o travamento.
        if (!order || !['requested', 'proposed'].includes(order.status)) return false;
        if (planExpiry([order], now).toExpire.length === 0) return false;
        await expireOrder(tx, emails, order, now);
        return true;
      });
      if (done) expired++;
    } catch (err) { logger.error('orders.expire', err); }
  }
  for (const item of toWarn) {
    try {
      const sent = await runTransaction(async (tx, emails) => {
        const order = await tx.order.findFirst({ where: { id: item.id, status: item.status } });
        if (!order) return false;
        const uuid = bufferToUuid(order.uuid);
        const href = `/contratacoes/${uuid}`;
        const left = item.hoursLeft <= 1 ? 'menos de 1 hora' : `${item.hoursLeft} horas`;
        const already = await tx.notification.findFirst({ where: { eventKey: `order-expiring:${uuid}:${item.status}:p` }, select: { id: true } });
        if (already) return false;
        if (item.status === 'requested') {
          await notify(tx, emails, order.professionalId, `order-expiring:${uuid}:requested:p`, `O pedido "${order.titleSnapshot}" vence em ${left}. Envie uma proposta ou recuse.`, href, 'order_update');
          await notify(tx, emails, order.clientId, `order-expiring:${uuid}:requested:c`, `O profissional ainda não respondeu "${order.titleSnapshot}". O pedido vence em ${left}.`, href, 'order_update');
        } else {
          await notify(tx, emails, order.clientId, `order-expiring:${uuid}:proposed:c`, `A proposta para "${order.titleSnapshot}" vence em ${left}. Aceite ou recuse.`, href, 'order_update');
          await notify(tx, emails, order.professionalId, `order-expiring:${uuid}:proposed:p`, `A sua proposta para "${order.titleSnapshot}" vence em ${left} sem resposta do cliente.`, href, 'order_update');
        }
        return true;
      });
      if (sent) warned++;
    } catch (err) { logger.error('orders.warn', err); }
  }
  return { expired, warned };
}

let timer = null;
export function startOrderExpiry(intervalMs = 10 * 60 * 1000) {
  if (timer) return;
  timer = setInterval(() => runOrderExpiry().catch((err) => logger.error('orders.expiry', err)), intervalMs);
  timer.unref();
}
