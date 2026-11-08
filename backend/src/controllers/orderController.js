import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { addressFor, availableActions, ORDER_STATUS_LABELS, roleIn, urgency, deadlineOf, VALIDITY_OPTIONS, DEFAULT_VALIDITY_HOURS, RESPONSE_HOURS } from '../utils/orderRules.js';
import { feeConfig } from '../config/fees.js';
import { openRequestConfig } from '../config/openRequests.js';
import { opportunityCount } from '../services/openRequests.js';
import { asaasActive } from '../services/payoutAccounts.js';
import { platformFeePercent } from '../services/platformFee.js';
import { computeCheckout, toCents, fromCents } from '../utils/money.js';
import { createOrder, transitionOrder, orderReviewContext, submitOrderReview } from '../services/orderWorkflow.js';
import { completeSchema } from '../validators/listingValidator.js';
import { unitsTotal } from '../utils/bookingSlots.js';
import { refundOnCancel } from '../services/asaasPayments.js';
import { openConversation, sendMessage } from '../services/messageService.js';
import { trustedMessageImage } from './messageController.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const me = (req) => BigInt(req.user.id);
const personSelect = { uuid: true, firstName: true, lastName: true, preferredName: true, profilePictureUrl: true };
const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
const person = (user) => ({ uuid: bufferToUuid(user.uuid), name: nameOf(user), profilePictureUrl: user.profilePictureUrl });
export const orderInclude = {
  listing: { select: { uuid: true, deletedAt: true, images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } } } },
  client: { select: personSelect },
  professional: { select: personSelect },
  service: { select: { uuid: true } },
};

export function serializeOrder(order, viewerId) {
  const price = order.priceSnapshot == null ? null : Number(order.priceSnapshot);
  const travelFee = order.travelFeeSnapshot == null ? null : Number(order.travelFeeSnapshot);
  const finalAmount = order.finalAmount == null ? null : Number(order.finalAmount);
  const fee = Number(order.platformFeePercent);
  return {
    uuid: bufferToUuid(order.uuid), status: order.status, statusLabel: ORDER_STATUS_LABELS[order.status],
    scheduledDate: order.scheduledDate.toISOString().slice(0, 10), serviceMode: order.serviceMode, packageName: order.packageName, note: order.note,
    title: order.titleSnapshot, service: order.service ? { uuid: bufferToUuid(order.service.uuid) } : null, listing: order.listing ? { uuid: bufferToUuid(order.listing.uuid), cover: order.listing.images[0]?.url ?? null, available: !order.listing.deletedAt } : null,
    client: person(order.client), professional: person(order.professional),
    pricingModel: order.pricingModelSnapshot, price, travelFee, total: order.pricingModelSnapshot === 'fixed' && price != null ? price + (travelFee ?? 0) : unitsTotal(order.pricingModelSnapshot, price, order.quantity, travelFee),
    scheduledTime: order.scheduledTime, endDate: order.endDate ? order.endDate.toISOString().slice(0, 10) : null, quantity: order.quantity, referenceImages: Array.isArray(order.referenceImages) ? order.referenceImages : [], serviceAddress: addressFor(order, viewerId),
    finalAmount, platformFeePercent: fee, netAmount: finalAmount == null ? null : Math.round(finalAmount * (100 - fee)) / 100,
    policy: order.policySnapshot, createdAt: order.createdAt, acceptedAt: order.acceptedAt, startedAt: order.startedAt, completedAt: order.completedAt, cancelledAt: order.cancelledAt,
    cancelledByMe: order.cancelledById != null && viewerId != null ? order.cancelledById === viewerId : null,
    role: viewerId == null ? null : roleIn(order, viewerId), actions: viewerId == null ? [] : availableActions(order, viewerId),
    declineReason: order.declineReason ?? null,
    origin: order.origin ?? 'anuncio',
    region: regionOf(order),
    deadline: deadlineOf(order) ?? null, urgency: urgency(order),
    proposal: order.proposalAmount == null ? null : {
      amount: Number(order.proposalAmount), days: order.proposalDays, date: order.proposalDate ? order.proposalDate.toISOString().slice(0, 10) : null,
      included: order.proposalIncluded, note: order.proposalNote, validUntil: order.proposalValidUntil, sentAt: order.proposedAt,
    },
  };
}

/** Bairro, cidade e estado do local do serviço: o suficiente para o profissional avaliar a distância, sem o endereço exato. */
function regionOf(order) {
  const address = order.serviceAddress;
  if (!address || typeof address !== 'object') return null;
  return [address.neighborhood, address.city, address.state].filter(Boolean).join(', ') || null;
}

export function sendWorkflowError(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err.code === 'P2002') return res.status(409).json({ message: 'Você já fez esta avaliação.' });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}

const pageParams = (req) => ({ page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(50, Math.max(1, Number(req.query.limit) || 20)) });
const STATUS_GROUPS = {
  new: ['requested'], proposed: ['proposed'], active: ['accepted', 'in_progress'], done: ['completed'], closed: ['declined', 'cancelled', 'expired'],
  requested: ['requested'], accepted: ['accepted'], in_progress: ['in_progress'], completed: ['completed'], declined: ['declined'], cancelled: ['cancelled'], expired: ['expired'],
};

export async function listOrders(req, res, side) {
  try {
    const { page, limit } = pageParams(req);
    const userId = me(req);
    const where = { [side === 'client' ? 'clientId' : 'professionalId']: userId, ...(STATUS_GROUPS[req.query.status] && { status: { in: STATUS_GROUPS[req.query.status] } }) };
    const [rows, total] = await prisma.$transaction([
      prisma.order.findMany({ where, include: orderInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      prisma.order.count({ where }),
    ]);
    res.set('Cache-Control', 'no-store').json({ data: rows.map((row) => serializeOrder(row, userId)), meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { sendWorkflowError(res, err, 'listOrders'); }
}

/** Quantidade de pedidos por aba, para os números ao lado dos nomes das abas. */
export async function orderCounts(req, res) {
  try {
    const field = req.query.side === 'client' ? 'clientId' : 'professionalId';
    const rows = await prisma.order.groupBy({ by: ['status'], where: { [field]: me(req) }, _count: { _all: true } });
    const byStatus = Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
    const sum = (statuses) => statuses.reduce((total, status) => total + (byStatus[status] ?? 0), 0);
    const counts = Object.fromEntries(Object.entries(STATUS_GROUPS).filter(([key]) => ['new', 'proposed', 'accepted', 'in_progress', 'active', 'done', 'closed'].includes(key)).map(([key, statuses]) => [key, sum(statuses)]));
    res.set('Cache-Control', 'no-store').json({ ...counts, all: sum(Object.keys(byStatus)) });
  } catch (err) { sendWorkflowError(res, err, 'orderCounts'); }
}

/** Números que pedem atenção no menu: pedidos novos (profissional) e propostas para decidir (cliente). */
export async function orderBadges(req, res) {
  try {
    const userId = me(req);
    const [proNew, clientProposed, openProposals, opportunities] = await Promise.all([
      prisma.order.count({ where: { professionalId: userId, status: 'requested' } }),
      prisma.order.count({ where: { clientId: userId, status: 'proposed' } }),
      prisma.proposal.count({ where: { status: 'pending', service: { clientId: userId, status: 'open', deletedAt: null } } }),
      openRequestConfig().enabled ? opportunityCount(userId).catch(() => 0) : 0,
    ]);
    res.set('Cache-Control', 'no-store').json({ proNew, clientToDecide: clientProposed + openProposals, opportunities });
  } catch (err) { sendWorkflowError(res, err, 'orderBadges'); }
}

/** Quanto o profissional recebe por um valor: comissão da plataforma já descontada (a taxa do meio de pagamento não entra). */
export function earningsPreview(req, res) {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return res.status(400).json({ message: 'Informe um valor maior que zero.' });
    const cfg = feeConfig();
    const commissionPercent = platformFeePercent();
    const clientFeePercent = asaasActive() ? cfg.clientFeePercent : 0;
    const split = computeCheckout({ serviceCents: toCents(amount), clientFeePercent, proCommissionPercent: commissionPercent });
    res.json({ amount, commissionPercent, commission: fromCents(split.commissionCents), earnings: fromCents(split.proGrossCents), clientFeePercent, clientTotal: fromCents(split.totalCents), validityOptions: VALIDITY_OPTIONS, defaultValidityHours: DEFAULT_VALIDITY_HOURS, responseHours: RESPONSE_HOURS });
  } catch (err) { sendWorkflowError(res, err, 'earningsPreview'); }
}

export const myOrders = (req, res) => listOrders(req, res, 'client');
export const proOrders = (req, res) => listOrders(req, res, 'professional');

export async function getOrder(req, res) {
  try {
    if (!UUID.test(req.params.uuid)) return res.status(404).json({ message: 'Pedido não encontrado.' });
    const userId = me(req);
    const order = await prisma.order.findFirst({ where: { uuid: uuidToBuffer(req.params.uuid) }, include: orderInclude });
    if (!order || !roleIn(order, userId)) return res.status(404).json({ message: 'Pedido não encontrado.' });
    const reviews = await prisma.review.findMany({ where: { orderId: order.id }, select: { reviewerId: true } });
    res.set('Cache-Control', 'no-store').json({ ...serializeOrder(order, userId), reviewedByMe: reviews.some((review) => review.reviewerId === userId) });
  } catch (err) { sendWorkflowError(res, err, 'getOrder'); }
}

export async function create(req, res) {
  try {
    const images = req.body.image_urls ?? [];
    if (images.some((url) => !trustedMessageImage(url, req))) return res.status(400).json({ message: 'Envie as fotos pelo próprio Dommos.' });
    const created = await createOrder(me(req), req.body);
    // A mensagem do cliente (e as fotos de referência) já abre a conversa com o profissional.
    let conversation = null;
    try {
      const opened = await openConversation(me(req), { orderUuid: created.uuid });
      conversation = opened.uuid;
      if (req.body.note) await sendMessage(me(req), conversation, { body: req.body.note, imageUrl: null });
      for (const url of images) await sendMessage(me(req), conversation, { body: '', imageUrl: url });
    } catch (err) { logger.error('orders.create.message', err); }
    res.status(201).json({ ...created, conversation });
  } catch (err) { sendWorkflowError(res, err, 'createOrder'); }
}

export async function act(req, res) {
  try {
    let body = {};
    if (['propose', 'decline'].includes(req.params.action)) body = req.body ?? {};
    if (req.params.action === 'complete') {
      const parsed = completeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) });
      body = parsed.data;
    }
    const result = await transitionOrder(req.params.uuid, me(req), req.params.action, body);
    // Pedido cancelado ou recusado: cancela cobranças abertas e estorna o que foi pago, conforme a política (Asaas).
    if (['cancel', 'decline'].includes(req.params.action)) await refundOnCancel(req.params.uuid).catch((error) => logger.error('order.refundOnCancel', error));
    res.json(result);
  } catch (err) { sendWorkflowError(res, err, 'orderAction'); }
}

export async function reviewContext(req, res) {
  try { res.set('Cache-Control', 'no-store').json(await orderReviewContext(req.params.uuid, me(req))); } catch (err) { sendWorkflowError(res, err, 'orderReviewContext'); }
}

export async function review(req, res) {
  try { res.status(201).json(await submitOrderReview(req.params.uuid, me(req), req.body)); } catch (err) { sendWorkflowError(res, err, 'orderReview'); }
}
