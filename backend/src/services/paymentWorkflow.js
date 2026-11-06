import { prisma } from '../config/prisma.js';
import { runTransaction, notify } from './serviceWorkflow.js';
import { activeProvider, providerByName } from './payments/index.js';
import { verifyWebhookSignature, MERCADOPAGO_STATUS_MAP } from './payments/mercadopagoProvider.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { pixKeyFromBrCode } from '../utils/pixBrCode.js';
import {
  ACTIVE_PAYMENT_STATUSES, METHOD_LABELS, ORDER_STATUSES_THAT_ALLOW_PAYMENT, PAYMENT_METHODS, PAYMENT_STATUS_LABELS,
  amountDue, availablePaymentActions, parseAcceptedMethods, paymentRole, resolvePaymentAction,
} from '../utils/paymentRules.js';
import { logger } from '../utils/logger.js';
import { asaasActive, approvedReceiver } from './payoutAccounts.js';
import { installmentOptions, scheduleAutoConfirm, startAsaasPayment } from './asaasPayments.js';
import { feeConfig } from '../config/fees.js';
import { computeCheckout, toCents } from '../utils/money.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
const personSelect = { id: true, uuid: true, firstName: true, lastName: true, preferredName: true, email: true, city: true };
const brl = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const receiptNumber = (id) => `DM-${String(id).padStart(8, '0')}`;

async function lockedOrderRow(tx, uuid) {
  if (!UUID.test(uuid)) fail(400, 'Pedido inválido.');
  const id = uuidToBuffer(uuid);
  await tx.$queryRaw`SELECT id FROM orders WHERE uuid = ${id} FOR UPDATE`;
  const order = await tx.order.findFirst({ where: { uuid: id }, include: { client: { select: personSelect }, professional: { select: personSelect } } });
  if (!order) fail(404, 'Pedido não encontrado.');
  return order;
}

async function lockedPayment(tx, uuid) {
  if (!UUID.test(uuid)) fail(404, 'Pagamento não encontrado.');
  const id = uuidToBuffer(uuid);
  await tx.$queryRaw`SELECT id FROM payments WHERE uuid = ${id} FOR UPDATE`;
  const payment = await tx.payment.findFirst({ where: { uuid: id }, include: { order: { select: { uuid: true, titleSnapshot: true } } } });
  if (!payment) fail(404, 'Pagamento não encontrado.');
  return payment;
}

async function receiverFor(db, user) {
  const settings = await db.userSettings.findUnique({ where: { userId: user.id }, select: { payoutKey: true, payoutKeyType: true, taxHolderName: true, acceptedPaymentMethods: true } });
  return {
    pixKey: settings?.payoutKey ?? null, pixKeyType: settings?.payoutKeyType ?? null,
    name: settings?.taxHolderName || nameOf(user), city: user.city || 'BRASIL',
    methods: parseAcceptedMethods(settings?.acceptedPaymentMethods ?? 'pix').filter((method) => method !== 'pix' || !!settings?.payoutKey),
  };
}

async function record(tx, payment, actorId, type, fromStatus, toStatus, detail = null) {
  return tx.paymentEvent.create({ data: { paymentId: payment.id, actorId, type, fromStatus, toStatus, detail } });
}

/** Mostra a chave Pix com parte dos dígitos escondida para quem só precisa reconhecê-la. */
export function maskKey(key) {
  if (!key) return null;
  if (key.includes('@')) { const [user, domain] = key.split('@'); return `${user.slice(0, 2)}***@${domain}`; }
  return key.length <= 6 ? '***' : `${key.slice(0, 3)}***${key.slice(-2)}`;
}

/** Campos extras do pagamento pela plataforma: valores em centavos, página do cartão, validade do Pix e situação do repasse. */
function asaasView(payment, role) {
  const cents = payment.amountCents ?? Math.round(Number(payment.amount) * 100);
  const confirmedByClient = (payment.events ?? []).some((item) => ['service_confirmed', 'service_auto_confirmed'].includes(item.type));
  return {
    amountCents: cents, serviceCents: cents - (payment.clientFeeCents ?? 0), clientFeeCents: payment.clientFeeCents ?? 0,
    ...(role === 'professional' && { commissionCents: payment.commissionCents, proShareCents: payment.proShareCents }),
    invoiceUrl: role === 'client' && ['pending', 'refused', 'expired'].includes(payment.status) ? payment.invoiceUrl : null,
    expiresAt: payment.expiresAt, payoutStatus: payment.payoutStatus, installments: payment.installments, refundedCents: payment.refundedCents,
    autoConfirmAt: payment.autoConfirmAt, serviceConfirmed: confirmedByClient,
    canConfirmService: role === 'client' && payment.status === 'confirmed' && payment.order?.status === 'completed' && !confirmedByClient,
    canDispute: role === 'client' && payment.status === 'confirmed' && !confirmedByClient,
  };
}

export function serializePayment(payment, viewerId, { events = false } = {}) {
  const role = paymentRole(payment, viewerId);
  const provider = providerByName(payment.provider);
  const open = payment.status === 'pending' || payment.status === 'reported';
  const key = payment.pixPayload ? pixKeyFromBrCode(payment.pixPayload) : null;
  return {
    uuid: bufferToUuid(payment.uuid), orderUuid: payment.order ? bufferToUuid(payment.order.uuid) : undefined, orderTitle: payment.order?.titleSnapshot,
    method: payment.method, methodLabel: METHOD_LABELS[payment.method], provider: payment.provider,
    status: payment.status, statusLabel: PAYMENT_STATUS_LABELS[payment.status], amount: Number(payment.amount), note: payment.note,
    role,
    // O BR Code e a chave só aparecem enquanto há algo a pagar e só para o cliente (quem paga) ou o dono da chave.
    // No pagamento pela plataforma o QR Code é só do cliente (quem paga); o profissional não precisa dele.
    pix: payment.method === 'pix' && payment.pixPayload && open && (payment.provider !== 'asaas' || role === 'client') ? { payload: payment.pixPayload, key: payment.provider === 'asaas' ? null : role === 'client' ? key : maskKey(key) } : null,
    ...(payment.provider === 'asaas' && asaasView(payment, role)),
    receiptNumber: payment.receiptNumber,
    createdAt: payment.createdAt, reportedAt: payment.reportedAt, confirmedAt: payment.confirmedAt, cancelledAt: payment.cancelledAt, refundedAt: payment.refundedAt,
    actions: payment.provider === 'asaas' ? (role === 'client' && payment.status === 'pending' ? ['cancel'] : []) : availablePaymentActions(payment, viewerId, { manual: provider.manual }),
    ...(events && payment.events ? { events: payment.events.map((item) => ({ type: item.type, from: item.fromStatus, to: item.toStatus, detail: item.detail, at: item.createdAt, byMe: item.actorId != null && item.actorId === viewerId })) } : {}),
  };
}

const paymentInclude = { order: { select: { uuid: true, titleSnapshot: true, status: true } } };

/** Situação de pagamento de um pedido, para a tela do pedido. */
/** Estado do pagamento de um pedido quando o Asaas é o provedor: valores, meios, parcelas e o que falta. */
async function asaasOrderState(order, userId) {
  const isClient = order.clientId === userId;
  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, provider: 'asaas', status: { not: 'cancelled' } }, orderBy: { id: 'desc' },
    include: { ...paymentInclude, events: { orderBy: { id: 'asc' } } },
  });
  const receiver = await approvedReceiver(order.professionalId);
  const due = amountDue(order);
  const cfg = feeConfig();
  const total = due == null ? null : computeCheckout({ serviceCents: toCents(due), clientFeePercent: cfg.clientFeePercent, proCommissionPercent: cfg.proCommissionPercent });
  const settings = isClient ? await prisma.userSettings.findUnique({ where: { userId }, select: { asaasCustomerId: true } }) : null;
  const allowed = ORDER_STATUSES_THAT_ALLOW_PAYMENT.includes(order.status);
  const retry = !payment || ['expired', 'refused'].includes(payment.status);
  return {
    amountDue: total ? total.totalCents / 100 : null, amountDueCents: total?.totalCents ?? null,
    breakdown: total && { serviceCents: total.serviceCents, clientFeeCents: total.clientFeeCents, totalCents: total.totalCents },
    ...(order.professionalId === userId && total && { proPreview: { commissionCents: total.commissionCents, proGrossCents: total.proGrossCents, gatewayFeePayer: cfg.gatewayFeePayer } }),
    canStart: isClient && allowed && due != null && !!receiver && retry,
    blockedReason: !retry ? null : !allowed ? 'O pagamento fica disponível depois que o profissional aceita o pedido.' : due == null ? 'O valor será definido quando o profissional concluir o serviço.' : !receiver ? 'O profissional ainda está liberando o recebimento pela plataforma. Tente de novo mais tarde.' : null,
    provider: 'asaas', automatic: true,
    methods: [{ value: 'pix', label: 'Pix' }, { value: 'credit_card', label: 'Cartão de crédito' }, { value: 'boleto', label: 'Boleto' }],
    installments: total ? installmentOptions(total.totalCents) : [],
    needsDocument: isClient && !settings?.asaasCustomerId,
    autoConfirmDays: cfg.autoConfirmDays,
    payment: payment ? serializePayment(payment, userId, { events: true }) : null,
  };
}

export async function orderPaymentState(orderUuid, userId) {
  if (!UUID.test(orderUuid)) fail(404, 'Pedido não encontrado.');
  const order = await prisma.order.findFirst({ where: { uuid: uuidToBuffer(orderUuid), OR: [{ clientId: userId }, { professionalId: userId }] }, include: { professional: { select: personSelect } } });
  if (!order) fail(404, 'Pedido não encontrado.');
  if (asaasActive()) return asaasOrderState(order, userId);
  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, status: { in: ACTIVE_PAYMENT_STATUSES } }, orderBy: { id: 'desc' },
    include: { ...paymentInclude, events: { orderBy: { id: 'asc' } } },
  });
  const receiver = await receiverFor(prisma, order.professional);
  const provider = activeProvider();
  const due = amountDue(order);
  return {
    amountDue: due,
    canStart: order.clientId === userId && !payment && due != null && ORDER_STATUSES_THAT_ALLOW_PAYMENT.includes(order.status) && receiver.methods.length > 0,
    blockedReason: payment ? null
      : !ORDER_STATUSES_THAT_ALLOW_PAYMENT.includes(order.status) ? 'O pagamento fica disponível depois que o profissional aceita o pedido.'
        : due == null ? 'O valor será definido quando o profissional concluir o serviço. Combine direto com ele até lá.'
          : receiver.methods.length === 0 ? 'O profissional ainda não configurou como recebe. Combine o pagamento direto com ele.' : null,
    methods: receiver.methods.map((method) => ({ value: method, label: PAYMENT_METHODS[method] })),
    provider: provider.name, automatic: !provider.manual,
    payment: payment ? serializePayment(payment, userId, { events: true }) : null,
  };
}

export async function startPayment(orderUuid, userId, method, extra = {}) {
  if (asaasActive()) {
    await startAsaasPayment(orderUuid, userId, { method, ...extra });
    return orderPaymentState(orderUuid, userId);
  }
  if (!(method in PAYMENT_METHODS)) fail(400, 'Escolha uma forma de pagamento válida.');
  const provider = activeProvider();
  const created = await runTransaction(async (tx, emails) => {
    const order = await lockedOrderRow(tx, orderUuid);
    if (order.clientId !== userId) fail(order.professionalId === userId ? 403 : 404, order.professionalId === userId ? 'Só o cliente inicia o pagamento.' : 'Pedido não encontrado.');
    if (!ORDER_STATUSES_THAT_ALLOW_PAYMENT.includes(order.status)) fail(409, 'O pagamento fica disponível depois que o profissional aceita o pedido.');
    const due = amountDue(order);
    if (due == null) fail(409, 'O valor será definido quando o profissional concluir o serviço.');
    const receiver = await receiverFor(tx, order.professional);
    if (!receiver.methods.includes(method)) fail(409, method === 'pix' ? 'O profissional ainda não cadastrou a chave Pix.' : 'O profissional não aceita esta forma de pagamento.');

    const existing = await tx.payment.findFirst({ where: { orderId: order.id, status: { in: ACTIVE_PAYMENT_STATUSES } }, orderBy: { id: 'desc' } });
    if (existing) {
      if (existing.method === method || existing.status !== 'pending') return { id: existing.id, reused: true };
      if (existing.provider !== 'manual') fail(409, 'Já existe uma cobrança aberta. Cancele-a antes de escolher outra forma.');
      const payment = { ...existing, method, uuidText: bufferToUuid(existing.uuid) };
      const charge = await providerByName('manual').createCharge({ payment, order, receiver, payer: order.client });
      await tx.payment.update({ where: { id: existing.id }, data: { method, pixPayload: charge.pixPayload ?? null } });
      await record(tx, existing, userId, 'method_changed', 'pending', 'pending', PAYMENT_METHODS[method]);
      return { id: existing.id, reused: true };
    }

    const uuid = generateUuid();
    const payment = await tx.payment.create({ data: { uuid, orderId: order.id, clientId: order.clientId, professionalId: order.professionalId, provider: provider.manual || method !== 'pix' ? 'manual' : provider.name, method, amount: due } });
    await record(tx, payment, userId, 'created', null, 'pending', PAYMENT_METHODS[method]);
    await notify(tx, emails, order.professionalId, `payment-created:${bufferToUuid(uuid)}`, `${nameOf(order.client)} vai pagar "${order.titleSnapshot}" (${brl(due)}) por ${PAYMENT_METHODS[method]}.`, `/contratacoes/${bufferToUuid(order.uuid)}`, 'payment_update');
    return { id: payment.id, order, receiver, due, method, uuid };
  });

  if (created.reused) return orderPaymentState(orderUuid, userId);

  // O Pix automático conversa com a internet: fica fora da transação para não segurar o banco.
  const useProvider = provider.manual || created.method !== 'pix' ? providerByName('manual') : provider;
  try {
    const row = await prisma.payment.findUnique({ where: { id: created.id } });
    const charge = await useProvider.createCharge({ payment: { ...row, uuidText: bufferToUuid(row.uuid) }, order: created.order, receiver: created.receiver, payer: created.order.client });
    await prisma.payment.update({ where: { id: created.id }, data: { externalId: charge.externalId ?? null, pixPayload: charge.pixPayload ?? null } });
  } catch (err) {
    await prisma.payment.update({ where: { id: created.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
    await prisma.paymentEvent.create({ data: { paymentId: created.id, actorId: userId, type: 'charge_failed', fromStatus: 'pending', toStatus: 'cancelled', detail: 'Falha ao criar a cobrança.' } });
    logger.error('payments.createCharge', err);
    throw err.status ? err : Object.assign(new Error('Não foi possível gerar o pagamento. Tente novamente.'), { status: 502 });
  }
  return orderPaymentState(orderUuid, userId);
}

const EVENT_TEXT = {
  report: (payment, actor) => `${actor} informou que pagou "${payment.order.titleSnapshot}". Confirme quando receber.`,
  confirm: (payment, actor) => `${actor} confirmou o recebimento do pagamento de "${payment.order.titleSnapshot}".`,
  reject: (payment, actor) => `${actor} não encontrou o pagamento de "${payment.order.titleSnapshot}". Confira e informe novamente.`,
  cancel: (payment, actor) => `${actor} cancelou a cobrança de "${payment.order.titleSnapshot}".`,
  refund: (payment, actor) => `${actor} registrou o estorno do pagamento de "${payment.order.titleSnapshot}".`,
};

export async function actOnPayment(paymentUuid, userId, action, body = {}) {
  // Primeiro a regra (sem rede). Se o provedor for automático, cancelar/estornar também avisa o provedor.
  const peek = await prisma.payment.findFirst({ where: { uuid: UUID.test(paymentUuid) ? uuidToBuffer(paymentUuid) : Buffer.alloc(16) } });
  if (!peek || !paymentRole(peek, userId)) fail(404, 'Pagamento não encontrado.');
  // No pagamento pela plataforma o dinheiro só se mexe pelo fluxo próprio (confirmar serviço, reclamar, administrador).
  if (peek.provider === 'asaas' && action !== 'cancel') fail(403, 'Esta ação não está disponível para este pagamento.');
  const provider = providerByName(peek.provider);
  if (!provider.manual && (action === 'cancel' || action === 'refund')) {
    resolvePaymentAction(peek, userId, action, { manual: provider.manual });
    await provider[action]({ ...peek, uuidText: bufferToUuid(peek.uuid) });
  }
  return runTransaction(async (tx, emails) => {
    const payment = await lockedPayment(tx, paymentUuid);
    const { to, role } = resolvePaymentAction(payment, userId, action, { manual: providerByName(payment.provider).manual });
    const now = new Date();
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null;
    const data = {
      status: to,
      ...(to === 'reported' && { reportedAt: now }),
      ...(to === 'confirmed' && { confirmedAt: now, receiptNumber: receiptNumber(payment.id) }),
      ...(to === 'cancelled' && { cancelledAt: now }),
      ...(to === 'refunded' && { refundedAt: now }),
      ...(action === 'reject' && { reportedAt: null }),
      ...(note && { note }),
    };
    await tx.payment.update({ where: { id: payment.id }, data });
    const event = await record(tx, payment, userId, action, payment.status, to, note);
    const actor = await tx.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, preferredName: true } });
    const other = role === 'client' ? payment.professionalId : payment.clientId;
    await notify(tx, emails, other, `payment-${action}:${paymentUuid}:${event.id}`, EVENT_TEXT[action](payment, nameOf(actor)), `/contratacoes/${bufferToUuid(payment.order.uuid)}`, 'payment_update');
    return { status: to };
  });
}

export async function listPayments(userId, role, { page, limit, status }) {
  const where = { [role === 'professional' ? 'professionalId' : 'clientId']: userId, ...(status && { status }) };
  const [rows, total] = await prisma.$transaction([
    prisma.payment.findMany({ where, include: paymentInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.payment.count({ where }),
  ]);
  return { data: rows.map((row) => serializePayment(row, userId)), meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

/** Recibo simples (não é nota fiscal). Só as duas partes veem, e só depois da confirmação. */
export async function getReceipt(paymentUuid, userId) {
  if (!UUID.test(paymentUuid)) fail(404, 'Pagamento não encontrado.');
  const payment = await prisma.payment.findFirst({
    where: { uuid: uuidToBuffer(paymentUuid), OR: [{ clientId: userId }, { professionalId: userId }] },
    include: { order: { select: { uuid: true, titleSnapshot: true, scheduledDate: true } }, client: { select: personSelect }, professional: { select: personSelect } },
  });
  if (!payment) fail(404, 'Pagamento não encontrado.');
  if (!['confirmed', 'refunded'].includes(payment.status) || !payment.receiptNumber) fail(409, 'O recibo fica disponível depois da confirmação do pagamento.');
  return {
    number: payment.receiptNumber, status: payment.status, statusLabel: PAYMENT_STATUS_LABELS[payment.status], amount: Number(payment.amount),
    method: payment.method, methodLabel: PAYMENT_METHODS[payment.method], confirmedAt: payment.confirmedAt, refundedAt: payment.refundedAt,
    orderUuid: bufferToUuid(payment.order.uuid), service: payment.order.titleSnapshot, serviceDate: payment.order.scheduledDate.toISOString().slice(0, 10),
    client: nameOf(payment.client), professional: nameOf(payment.professional),
    notice: 'Recibo simples gerado pelo Dommos. O pagamento foi combinado direto entre as partes e este documento não é nota fiscal.',
  };
}

/** Chamado pelo fluxo de pedidos: encerra ou ajusta cobranças abertas quando o pedido muda. */
export async function syncPaymentsWithOrder(tx, order, newStatus, finalAmount) {
  // Concluído: o pagamento pela plataforma começa a contar o prazo de confirmação automática.
  if (newStatus === 'completed') await scheduleAutoConfirm(tx, order.id);
  if (['cancelled', 'declined'].includes(newStatus)) {
    // Cobranças do Asaas são canceladas e estornadas por refundOnCancel (fala com o gateway, fora da transação).
    const open = await tx.payment.findMany({ where: { orderId: order.id, status: { in: ['pending', 'reported'] }, provider: { not: 'asaas' } } });
    for (const payment of open) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
      await record(tx, payment, null, 'order_closed', payment.status, 'cancelled', 'Pedido encerrado.');
    }
  }
  if (newStatus === 'completed' && finalAmount != null) {
    const open = await tx.payment.findMany({ where: { orderId: order.id, status: 'pending' } });
    for (const payment of open) {
      if (Number(payment.amount) === Number(finalAmount)) continue;
      // Cobrança automática já emitida não muda de valor: o profissional cancela e o cliente gera outra.
      if (payment.provider !== 'manual') continue;
      let pixPayload = null;
      if (payment.method === 'pix') {
        const receiver = await receiverFor(tx, order.professional);
        const charge = await providerByName('manual').createCharge({ payment: { ...payment, amount: finalAmount }, receiver });
        pixPayload = charge.pixPayload ?? null;
      }
      await tx.payment.update({ where: { id: payment.id }, data: { amount: finalAmount, pixPayload } });
      await record(tx, payment, null, 'amount_updated', 'pending', 'pending', `Valor final: ${brl(finalAmount)}`);
    }
  }
}

/** Webhook do Mercado Pago: valida a assinatura, consulta o pagamento no provedor e aplica o status. */
export async function processMercadoPagoWebhook({ signature, requestId, dataId }) {
  const id = verifyWebhookSignature({ signature, requestId, dataId, secret: process.env.MP_WEBHOOK_SECRET });
  const provider = providerByName('mercadopago');
  const remote = await provider.fetchPayment(id);
  const nextStatus = MERCADOPAGO_STATUS_MAP[remote.status] ?? 'pending';
  const eventKey = `${id}:${remote.status}`;
  return runTransaction(async (tx, emails) => {
    const known = await tx.webhookEvent.findUnique({ where: { provider_eventKey: { provider: 'mercadopago', eventKey } } });
    if (known) return { duplicate: true };
    const found = await tx.payment.findFirst({ where: { externalId: String(id) }, select: { uuid: true } });
    if (!found) return { ignored: true };
    const payment = await lockedPayment(tx, bufferToUuid(found.uuid));
    if (Math.round(Number(remote.transaction_amount) * 100) !== Math.round(Number(payment.amount) * 100)) {
      logger.error('payments.webhook.amountMismatch', new Error(`payment ${bufferToUuid(payment.uuid)}`));
      return { ignored: true };
    }
    await tx.webhookEvent.create({ data: { provider: 'mercadopago', eventKey } });
    const allowed = { pending: [], confirmed: ['pending', 'reported'], cancelled: ['pending', 'reported'], refunded: ['confirmed'] };
    if (!allowed[nextStatus].includes(payment.status)) return { ignored: true };
    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: nextStatus, ...(nextStatus === 'confirmed' && { confirmedAt: now, receiptNumber: receiptNumber(payment.id) }), ...(nextStatus === 'cancelled' && { cancelledAt: now }), ...(nextStatus === 'refunded' && { refundedAt: now }) },
    });
    await record(tx, payment, null, 'webhook', payment.status, nextStatus, `mercadopago:${remote.status}`);
    const orderUuid = bufferToUuid(payment.order.uuid);
    for (const recipient of [payment.clientId, payment.professionalId]) {
      await notify(tx, emails, recipient, `payment-webhook:${bufferToUuid(payment.uuid)}:${nextStatus}:${recipient}`, `Pagamento de "${payment.order.titleSnapshot}": ${PAYMENT_STATUS_LABELS[nextStatus].toLowerCase()}.`, `/contratacoes/${orderUuid}`, 'payment_update');
    }
    return { status: nextStatus };
  });
}

/** Salva como o profissional recebe: chave Pix e formas aceitas. */
export async function saveReceivingSettings(userId, { pixKeyType, pixKey, methods }) {
  const data = { acceptedPaymentMethods: methods.join(',') };
  if (pixKeyType !== undefined) { data.payoutKeyType = pixKey ? pixKeyType : null; data.payoutKey = pixKey || null; }
  await prisma.userSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}
