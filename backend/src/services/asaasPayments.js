import { prisma } from '../config/prisma.js';
import { feeConfig } from '../config/fees.js';
import { runTransaction, notify } from './serviceWorkflow.js';
import { providerByName } from './payments/index.js';
import { approvedReceiver } from './payoutAccounts.js';
import { amountDue } from '../utils/paymentRules.js';
import { canTransition, planPaymentEvent, REFUNDABLE } from '../utils/asaasEvents.js';
import { computeCheckout, formatCents, refundCents, toCents } from '../utils/money.js';
import { isValidCnpj, isValidCpf, onlyDigits } from '../utils/taxDocument.js';
import { bufferToUuid, generateUuid, uuidToBuffer } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 24 * 60 * 60 * 1000;
const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
const receiptNumber = (id) => `DM-${String(id).padStart(8, '0')}`;
const personSelect = { id: true, uuid: true, firstName: true, lastName: true, preferredName: true, email: true };
const asaas = () => providerByName('asaas');

export const ASAAS_METHODS = ['pix', 'credit_card', 'boleto'];
export const MIN_INSTALLMENT_CENTS = 1000; // regra nossa: parcelas de pelo menos R$ 10,00
export const MAX_INSTALLMENTS = 12;

/** Parcelas possíveis para um total. O Dommos não soma juros: o total é o mesmo em qualquer número de parcelas. */
export function installmentOptions(totalCents) {
  const options = [];
  for (let count = 1; count <= MAX_INSTALLMENTS; count += 1) {
    if (count === 1 || Math.floor(totalCents / count) >= MIN_INSTALLMENT_CENTS) options.push({ count, valueCents: Math.round(totalCents / count) });
  }
  return options;
}

const record = (db, payment, actorId, type, fromStatus, toStatus, detail = null) =>
  db.paymentEvent.create({ data: { paymentId: payment.id, actorId, type, fromStatus, toStatus, detail: detail?.slice(0, 300) ?? null } });

async function lockPayment(tx, id) {
  await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`;
  return tx.payment.findUnique({ where: { id }, include: { order: { select: { id: true, uuid: true, titleSnapshot: true, status: true, scheduledDate: true, policySnapshot: true } } } });
}

// ---- Pagar -----------------------------------------------------------------------------------------------------
/** Cria a cobrança no Asaas. Só o cliente do pedido, com pedido aceito e o recebimento do profissional aprovado. */
export async function startAsaasPayment(orderUuid, userId, { method, installments = 1, cpfCnpj } = {}) {
  if (!ASAAS_METHODS.includes(method)) fail(400, 'Escolha Pix, cartão de crédito ou boleto.');
  if (!UUID.test(orderUuid)) fail(404, 'Pedido não encontrado.');
  const cfg = feeConfig();
  const prepared = await runTransaction(async (tx) => {
    const orderId = uuidToBuffer(orderUuid);
    await tx.$queryRaw`SELECT id FROM orders WHERE uuid = ${orderId} FOR UPDATE`;
    const order = await tx.order.findFirst({ where: { uuid: orderId }, include: { client: { select: personSelect } } });
    if (!order) fail(404, 'Pedido não encontrado.');
    if (order.clientId !== userId) fail(order.professionalId === userId ? 403 : 404, order.professionalId === userId ? 'Só o cliente inicia o pagamento.' : 'Pedido não encontrado.');
    if (!['accepted', 'in_progress', 'completed'].includes(order.status)) fail(409, 'O pagamento fica disponível depois que o profissional aceita o pedido.');
    const due = amountDue(order);
    if (due == null) fail(409, 'O valor será definido quando o profissional concluir o serviço.');
    const receiver = await approvedReceiver(order.professionalId);
    if (!receiver) fail(409, 'O profissional ainda está liberando o recebimento pela plataforma. Tente de novo mais tarde ou combine direto com ele.');

    const active = await tx.payment.findFirst({ where: { orderId: order.id, status: { in: ['pending', 'confirmed', 'disputed'] } }, orderBy: { id: 'desc' } });
    if (active && (active.status !== 'pending' || (active.method === method && active.provider === 'asaas'))) return { reuse: true };

    const settings = await tx.userSettings.findUnique({ where: { userId }, select: { asaasCustomerId: true, taxDocument: true } });
    let payerDocument = null;
    if (!settings?.asaasCustomerId) {
      // O CPF/CNPJ já salvo em Configurações > Impostos vale; só pede se não houver um válido.
      payerDocument = onlyDigits(cpfCnpj || settings?.taxDocument || '');
      if (!(payerDocument.length === 11 ? isValidCpf(payerDocument) : payerDocument.length === 14 && isValidCnpj(payerDocument))) fail(422, 'Informe um CPF ou CNPJ válido para o pagamento.');
    }
    const parts = Number(installments);
    const total = computeCheckout({ serviceCents: toCents(due), clientFeePercent: cfg.clientFeePercent, proCommissionPercent: cfg.proCommissionPercent });
    if (method === 'credit_card' && !installmentOptions(total.totalCents).some((option) => option.count === parts)) fail(422, 'Número de parcelas indisponível para este valor.');
    const payment = await tx.payment.create({
      data: {
        uuid: generateUuid(), orderId: order.id, clientId: order.clientId, professionalId: order.professionalId, provider: 'asaas', method,
        amount: total.totalCents / 100, amountCents: total.totalCents, clientFeeCents: total.clientFeeCents, commissionCents: total.commissionCents,
        proShareCents: total.proGrossCents, platformShareCents: total.platformGrossCents, installments: method === 'credit_card' ? parts : null,
        feeSnapshot: { ...cfg, serviceCents: total.serviceCents }, // as taxas da hora da contratação: mudar a configuração depois não altera este pedido
      },
    });
    await record(tx, payment, userId, 'created', null, 'pending', method);
    return { reuse: false, payment, order, total, receiver, payerDocument, customerId: settings?.asaasCustomerId ?? null, replace: active?.externalId ?? null };
  });
  if (prepared.reuse) return { reused: true };

  // Fora da transação: fala com a internet e não segura o banco.
  if (prepared.replace) await asaas().cancel({ externalId: prepared.replace }).catch(() => {});
  if (prepared.replace) await prisma.payment.updateMany({ where: { externalId: prepared.replace, status: 'pending' }, data: { status: 'cancelled', cancelledAt: new Date() } });
  const { payment, order, total, receiver } = prepared;
  try {
    const charge = await asaas().createCharge({
      payment: { uuidText: bufferToUuid(payment.uuid) }, order, method, installments: payment.installments ?? 1, amounts: total,
      gatewayFeePayer: cfg.gatewayFeePayer, receiver,
      payer: { name: nameOf(order.client), email: order.client.email, cpfCnpj: prepared.payerDocument, customerId: prepared.customerId, externalReference: bufferToUuid(order.client.uuid) },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: charge.externalId, pixPayload: charge.pixPayload, invoiceUrl: charge.invoiceUrl, expiresAt: charge.expiresAt,
        proShareCents: charge.proShareCents, platformShareCents: charge.platformShareCents, gatewayFeeCents: charge.netCents == null ? null : total.totalCents - charge.netCents,
      },
    });
    if (!prepared.customerId && charge.customerId) {
      await prisma.userSettings.upsert({ where: { userId }, create: { userId, asaasCustomerId: charge.customerId }, update: { asaasCustomerId: charge.customerId } });
    }
  } catch (error) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
    await prisma.paymentEvent.create({ data: { paymentId: payment.id, actorId: userId, type: 'charge_failed', fromStatus: 'pending', toStatus: 'cancelled', detail: String(error.message).slice(0, 300) } });
    logger.error('asaas.startPayment', error);
    throw error.status ? error : Object.assign(new Error('Não foi possível gerar o pagamento. Tente novamente.'), { status: 502 });
  }
  return { reused: false, paymentUuid: bufferToUuid(payment.uuid) };
}

// ---- Eventos do gateway (webhook e conciliação) -----------------------------------------------------------------
const MESSAGES = {
  confirmed: (title, cents) => [`O pagamento de "${title}" (${formatCents(cents)}) foi confirmado.`, `O cliente pagou "${title}" (${formatCents(cents)}). Você já pode fazer o serviço.`],
  expired: (title) => [`O pagamento de "${title}" expirou. Gere um novo para continuar.`, null],
  refused: (title) => [`O pagamento de "${title}" foi recusado. Tente outro meio de pagamento.`, null],
  cancelled: (title) => [`A cobrança de "${title}" foi cancelada.`, null],
  refunded: (title) => [`O pagamento de "${title}" foi estornado.`, `O pagamento de "${title}" foi estornado ao cliente.`],
  chargeback: (title) => [`O pagamento de "${title}" entrou em contestação no cartão.`, `O pagamento de "${title}" entrou em contestação (chargeback). O valor pode ser retido.`],
  split_done: (title) => [null, `O valor de "${title}" foi repassado para o seu recebimento.`],
  partial_refund: (title) => [`Parte do pagamento de "${title}" foi estornada.`, `Parte do pagamento de "${title}" foi estornada ao cliente.`],
};

/** Aplica um evento (de webhook ou da conciliação) a um pagamento. Seguro repetir. */
export async function applyPaymentEvent(event, { source = 'webhook' } = {}) {
  const externalId = event?.payment?.id;
  if (!externalId) return { ignored: 'sem_pagamento' };
  const found = await prisma.payment.findFirst({ where: { externalId, provider: 'asaas' }, select: { id: true } });
  if (!found) return { ignored: 'pagamento_desconhecido' };
  const cfg = feeConfig();
  return runTransaction(async (tx, emails) => {
    const payment = await lockPayment(tx, found.id);
    const account = await tx.payoutAccount.findUnique({ where: { userId: payment.professionalId }, select: { escrowEnabled: true } });
    const plan = planPaymentEvent(event, payment, { escrowEnabled: !!account?.escrowEnabled });
    if (plan.alert) await record(tx, payment, null, `alert:${plan.alert}`, payment.status, payment.status, event.event);
    if (plan.action === 'ignore') return { ignored: plan.reason };
    const data = { ...plan.patch };
    if (plan.to === 'confirmed') {
      data.receiptNumber = payment.receiptNumber ?? receiptNumber(payment.id);
      if (payment.order.status === 'completed') data.autoConfirmAt = new Date(Date.now() + cfg.autoConfirmDays * DAY);
    }
    if (Object.keys(data).length) await tx.payment.update({ where: { id: payment.id }, data });
    await record(tx, payment, null, source, payment.status, plan.to ?? payment.status, event.event);
    const text = MESSAGES[plan.notice]?.(payment.order.titleSnapshot, payment.amountCents ?? 0);
    const href = `/contratacoes/${bufferToUuid(payment.order.uuid)}`;
    if (text) {
      const key = `asaas:${event.id ?? `${externalId}:${event.event}`}`;
      if (text[0]) await notify(tx, emails, payment.clientId, `${key}:c`, text[0], href, 'payment_update');
      if (text[1]) await notify(tx, emails, payment.professionalId, `${key}:p`, text[1], href, 'payment_update');
    }
    return { applied: true, to: plan.to ?? payment.status };
  });
}

// ---- Concluir, liberar, reclamar -------------------------------------------------------------------------------
async function releaseAtGateway(payment) {
  const receiver = await approvedReceiver(payment.professionalId, { withKey: true });
  if (receiver?.escrowEnabled) {
    if (!receiver.apiKey) fail(502, 'Não foi possível ler a chave da conta de recebimento.');
    await asaas().releaseEscrow(payment, receiver.apiKey);
  }
  return !!receiver?.escrowEnabled;
}

/** O cliente confirma que o serviço foi feito: o valor retido é liberado ao profissional. */
export async function confirmService(paymentUuid, userId, { automatic = false } = {}) {
  if (!UUID.test(paymentUuid)) fail(404, 'Pagamento não encontrado.');
  const base = await prisma.payment.findFirst({ where: { uuid: uuidToBuffer(paymentUuid), provider: 'asaas' }, include: { order: { select: { status: true } } } });
  if (!base || (!automatic && base.clientId !== userId)) fail(404, 'Pagamento não encontrado.');
  if (base.status !== 'confirmed') fail(409, base.status === 'disputed' ? 'Há uma reclamação aberta neste pagamento.' : 'Este pagamento não está pago.');
  if (base.order.status !== 'completed') fail(409, 'O profissional ainda não concluiu o serviço.');
  if (await prisma.paymentEvent.findFirst({ where: { paymentId: base.id, type: { in: ['service_confirmed', 'service_auto_confirmed'] } }, select: { id: true } })) return { alreadyConfirmed: true };
  let released;
  try { released = await releaseAtGateway(base); } catch (error) {
    await prisma.paymentEvent.create({ data: { paymentId: base.id, actorId: automatic ? null : userId, type: 'alert:release_failed', fromStatus: base.status, toStatus: base.status, detail: String(error.message).slice(0, 300) } });
    throw error;
  }
  return runTransaction(async (tx, emails) => {
    const payment = await lockPayment(tx, base.id);
    await tx.payment.update({ where: { id: payment.id }, data: { autoConfirmAt: null, ...(released && { payoutStatus: 'released', releasedAt: new Date() }) } });
    await record(tx, payment, automatic ? null : userId, automatic ? 'service_auto_confirmed' : 'service_confirmed', payment.status, payment.status);
    await notify(tx, emails, payment.professionalId, `asaas-confirm:${payment.id}`, `${automatic ? 'O prazo de confirmação acabou' : 'O cliente confirmou o serviço'} "${payment.order.titleSnapshot}": o valor foi liberado.`, `/contratacoes/${bufferToUuid(payment.order.uuid)}`, 'payment_update');
    return { released };
  });
}

/** Reclamação do cliente antes da liberação: o pagamento fica "em análise" até o administrador decidir. */
export async function openDispute(paymentUuid, userId, reason) {
  const text = String(reason ?? '').trim();
  if (text.length < 10 || text.length > 500) fail(400, 'Conte o que aconteceu, de 10 a 500 caracteres.');
  if (!UUID.test(paymentUuid)) fail(404, 'Pagamento não encontrado.');
  return runTransaction(async (tx, emails) => {
    const found = await tx.payment.findFirst({ where: { uuid: uuidToBuffer(paymentUuid), provider: 'asaas' }, select: { id: true, clientId: true } });
    if (!found || found.clientId !== userId) fail(404, 'Pagamento não encontrado.');
    const payment = await lockPayment(tx, found.id);
    if (payment.status !== 'confirmed') fail(409, payment.status === 'disputed' ? 'Já existe uma reclamação aberta.' : 'Só dá para reclamar de um pagamento confirmado.');
    if (await tx.paymentEvent.findFirst({ where: { paymentId: payment.id, type: { in: ['service_confirmed', 'service_auto_confirmed'] } }, select: { id: true } })) fail(409, 'O serviço já foi confirmado e o valor liberado.');
    await tx.paymentDispute.create({ data: { paymentId: payment.id, openedById: userId, reason: text } });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'disputed', autoConfirmAt: null } });
    await record(tx, payment, userId, 'dispute_opened', 'confirmed', 'disputed', text);
    await notify(tx, emails, payment.professionalId, `asaas-dispute:${payment.id}:${Date.now()}`, `O cliente abriu uma reclamação sobre "${payment.order.titleSnapshot}". O pagamento fica em análise.`, `/contratacoes/${bufferToUuid(payment.order.uuid)}`, 'payment_update');
    return { status: 'disputed' };
  });
}

/** Decisão do administrador: liberar ao profissional ou estornar ao cliente. */
export async function resolveDispute(adminId, disputeId, decision, note) {
  if (!['release', 'refund'].includes(decision)) fail(400, 'Escolha liberar ou estornar.');
  if (!/^\d{1,18}$/.test(String(disputeId))) fail(404, 'Reclamação não encontrada.');
  const dispute = await prisma.paymentDispute.findUnique({ where: { id: BigInt(disputeId) }, include: { payment: true } });
  if (!dispute) fail(404, 'Reclamação não encontrada.');
  if (dispute.status !== 'open') fail(409, 'Esta reclamação já foi resolvida.');
  const payment = dispute.payment;
  if (payment.status !== 'disputed') fail(409, 'O pagamento não está em análise.');
  const resolution = String(note ?? '').trim().slice(0, 500) || null;
  try {
    if (decision === 'refund') await asaas().refund(payment, { reason: 'Reclamação resolvida a favor do cliente' });
    else await releaseAtGateway(payment);
  } catch (error) {
    await prisma.paymentEvent.create({ data: { paymentId: payment.id, actorId: adminId, type: `alert:${decision}_failed`, fromStatus: 'disputed', toStatus: 'disputed', detail: String(error.message).slice(0, 300) } });
    throw error;
  }
  return runTransaction(async (tx, emails) => {
    const locked = await lockPayment(tx, payment.id);
    const refund = decision === 'refund';
    await tx.payment.update({ where: { id: locked.id }, data: refund ? { status: 'refunded', refundedAt: new Date(), payoutStatus: 'refunded', refundedCents: locked.amountCents ?? 0 } : { status: 'confirmed', autoConfirmAt: null, payoutStatus: 'released', releasedAt: new Date() } });
    await tx.paymentDispute.update({ where: { id: dispute.id }, data: { status: refund ? 'resolved_refund' : 'resolved_release', resolution, resolvedById: adminId, resolvedAt: new Date() } });
    await record(tx, locked, adminId, refund ? 'dispute_refunded' : 'dispute_released', 'disputed', refund ? 'refunded' : 'confirmed', resolution);
    const href = `/contratacoes/${bufferToUuid(locked.order.uuid)}`;
    const key = `asaas-resolve:${dispute.id}`;
    await notify(tx, emails, locked.clientId, `${key}:c`, refund ? `A sua reclamação sobre "${locked.order.titleSnapshot}" foi resolvida: o valor será estornado.` : `A sua reclamação sobre "${locked.order.titleSnapshot}" foi analisada: o valor foi liberado ao profissional.`, href, 'payment_update');
    await notify(tx, emails, locked.professionalId, `${key}:p`, refund ? `A reclamação sobre "${locked.order.titleSnapshot}" foi resolvida com estorno ao cliente.` : `A reclamação sobre "${locked.order.titleSnapshot}" foi resolvida a seu favor: o valor foi liberado.`, href, 'payment_update');
    return { status: refund ? 'resolved_refund' : 'resolved_release' };
  });
}

// ---- Cancelamento do pedido ----------------------------------------------------------------------------------------
/** Depois que o pedido é cancelado ou recusado: cancela cobranças abertas e estorna o que foi pago, conforme a política. */
export async function refundOnCancel(orderUuid, now = new Date()) {
  if (!UUID.test(orderUuid)) return { refunds: 0 };
  const order = await prisma.order.findFirst({ where: { uuid: uuidToBuffer(orderUuid) }, select: { id: true, scheduledDate: true, policySnapshot: true, titleSnapshot: true, clientId: true, professionalId: true, uuid: true, status: true, cancelledById: true } });
  if (!order) return { refunds: 0 };
  // Recusar é sempre do profissional; cancelar, de quem cancelou.
  const canceledBy = order.status === 'declined' || order.cancelledById === order.professionalId ? 'professional' : 'client';
  const payments = await prisma.payment.findMany({ where: { orderId: order.id, provider: 'asaas', status: { in: ['pending', 'confirmed'] } } });
  let refunds = 0;
  for (const payment of payments) {
    if (payment.status === 'pending') {
      if (payment.externalId) await asaas().cancel(payment).catch((error) => logger.error('asaas.cancelOnOrder', error));
      await prisma.payment.updateMany({ where: { id: payment.id, status: 'pending' }, data: { status: 'cancelled', cancelledAt: now } });
      continue;
    }
    const hoursUntilService = (order.scheduledDate.getTime() + 11 * 60 * 60 * 1000 - now.getTime()) / (60 * 60 * 1000);
    const cents = refundCents({ totalCents: payment.amountCents, policy: order.policySnapshot, hoursUntilService, canceledBy });
    if (cents <= 0) {
      await prisma.paymentEvent.create({ data: { paymentId: payment.id, actorId: null, type: 'no_refund', fromStatus: payment.status, toStatus: payment.status, detail: 'Cancelamento fora do prazo da política: sem reembolso.' } });
      continue;
    }
    const full = cents >= payment.amountCents;
    try {
      await asaas().refund(payment, { ...(full ? {} : { cents }), reason: `Pedido cancelado por ${canceledBy === 'professional' ? 'profissional' : 'cliente'}` });
    } catch (error) {
      await prisma.paymentEvent.create({ data: { paymentId: payment.id, actorId: null, type: 'alert:refund_failed', fromStatus: payment.status, toStatus: payment.status, detail: String(error.message).slice(0, 300) } });
      logger.error('asaas.refundOnCancel', error);
      continue;
    }
    refunds += 1;
    await runTransaction(async (tx, emails) => {
      const locked = await lockPayment(tx, payment.id);
      await tx.payment.update({ where: { id: locked.id }, data: full ? { status: 'refunded', refundedAt: now, payoutStatus: 'refunded', refundedCents: cents } : { refundedCents: cents } });
      await record(tx, locked, null, full ? 'refunded_on_cancel' : 'partially_refunded_on_cancel', locked.status, full ? 'refunded' : locked.status, `${formatCents(cents)} conforme a política de cancelamento`);
      const href = `/contratacoes/${bufferToUuid(order.uuid)}`;
      await notify(tx, emails, order.clientId, `asaas-cancel:${locked.id}:c`, `${full ? 'O valor total' : `Parte do valor (${formatCents(cents)})`} do pagamento de "${order.titleSnapshot}" será estornado.`, href, 'payment_update');
      await notify(tx, emails, order.professionalId, `asaas-cancel:${locked.id}:p`, `O pagamento de "${order.titleSnapshot}" foi estornado ao cliente${full ? '' : ` em ${formatCents(cents)}`}.`, href, 'payment_update');
    });
  }
  return { refunds };
}

// ---- Rotinas agendadas -------------------------------------------------------------------------------------------------
const SYNTHETIC = { confirmed: 'PAYMENT_RECEIVED', expired: 'PAYMENT_OVERDUE', refunded: 'PAYMENT_REFUNDED', chargeback: 'PAYMENT_CHARGEBACK_REQUESTED', cancelled: 'PAYMENT_DELETED' };

/** Conciliação: confere no gateway os pagamentos que seguem pendentes, para o caso de um webhook ter se perdido. */
export async function reconcilePending(now = new Date()) {
  const pending = await prisma.payment.findMany({
    where: { provider: 'asaas', status: 'pending', externalId: { not: null }, createdAt: { lt: new Date(now.getTime() - 10 * 60 * 1000), gt: new Date(now.getTime() - 35 * DAY) } },
    orderBy: { id: 'asc' }, take: 50,
  });
  let fixed = 0;
  for (const payment of pending) {
    try {
      const remote = await asaas().getStatus(payment);
      if (remote !== 'pending' && SYNTHETIC[remote]) {
        const result = await applyPaymentEvent({ id: `reconcile:${payment.externalId}:${remote}`, event: SYNTHETIC[remote], payment: { id: payment.externalId } }, { source: 'reconcile' });
        if (result.applied) fixed += 1;
      }
    } catch (error) { logger.error('asaas.reconcile', error); }
  }
  return { checked: pending.length, fixed };
}

/** Confirmação automática: passado o prazo sem reclamação, o valor é liberado. */
export async function autoConfirmDue(now = new Date()) {
  const due = await prisma.payment.findMany({ where: { provider: 'asaas', status: 'confirmed', autoConfirmAt: { lte: now } }, take: 50 });
  let released = 0;
  for (const payment of due) {
    try { await confirmService(bufferToUuid(payment.uuid), payment.clientId, { automatic: true }); released += 1; } catch (error) { logger.error('asaas.autoConfirm', error); }
  }
  return { due: due.length, released };
}

/** Quando o profissional conclui o serviço: pagamentos pagos entram na contagem da confirmação automática. */
export async function scheduleAutoConfirm(tx, orderId, now = new Date()) {
  const cfg = feeConfig();
  await tx.payment.updateMany({ where: { orderId, provider: 'asaas', status: 'confirmed', autoConfirmAt: null }, data: { autoConfirmAt: new Date(now.getTime() + cfg.autoConfirmDays * DAY) } });
}

export { canTransition, REFUNDABLE };
