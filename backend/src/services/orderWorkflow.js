import { runTransaction, notify } from './serviceWorkflow.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { resolveTransition, computeAmounts, bookingDateError, weekdayOf } from '../utils/orderRules.js';
import { addDays, daysOf, hasConflict, normalizeQuantity, slotError } from '../utils/bookingSlots.js';
import { syncPaymentsWithOrder } from './paymentWorkflow.js';
import { platformFeePercent } from './platformFee.js';
import { registerConnectionSource } from '../utils/connections.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
const brDate = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value)).split('-').reverse().join('/');
const personSelect = { id: true, uuid: true, firstName: true, lastName: true, preferredName: true, city: true };

export { platformFeePercent };

// Contratações aceitas contam como "conexão" entre cliente e profissional.
registerConnectionSource(async (db, userId, add) => {
  const orders = await db.order.findMany({
    where: { status: { in: ['accepted', 'in_progress', 'completed'] }, OR: [{ clientId: userId }, { professionalId: userId }] },
    select: { clientId: true, professionalId: true, updatedAt: true },
  });
  for (const order of orders) add(order.clientId === userId ? order.professionalId : order.clientId, order.updatedAt);
});

async function lockedOrder(tx, uuid) {
  if (!UUID.test(uuid)) fail(400, 'Pedido inválido.');
  const id = uuidToBuffer(uuid);
  await tx.$queryRaw`SELECT id FROM orders WHERE uuid = ${id} FOR UPDATE`;
  const order = await tx.order.findFirst({ where: { uuid: id }, include: { client: { select: personSelect }, professional: { select: personSelect }, service: { select: { id: true, uuid: true } } } });
  if (!order) fail(404, 'Pedido não encontrado.');
  return order;
}

export async function createOrder(userId, body, now = new Date()) {
  return runTransaction(async (tx, emails) => {
    const client = await tx.user.findFirst({ where: { id: userId, deletedAt: null, deactivatedAt: null }, select: personSelect });
    if (!client) fail(401, 'Conta indisponível. Entre novamente.');
    const listing = await tx.listing.findFirst({
      where: { uuid: uuidToBuffer(body.listing_uuid), status: 'published', deletedAt: null, owner: { deletedAt: null, deactivatedAt: null } },
    });
    if (!listing) fail(404, 'Este anúncio não está disponível.');
    if (listing.ownerId === userId) fail(400, 'Você não pode contratar o seu próprio anúncio.');
    const blocked = await tx.userBlock.findFirst({ where: { OR: [{ blockerId: userId, blockedId: listing.ownerId }, { blockerId: listing.ownerId, blockedId: userId }] }, select: { blockerId: true } });
    if (blocked) fail(403, 'Não é possível contratar este anúncio.');

    const modes = [listing.atClientPlace && 'client_place', listing.atProPlace && 'pro_place', listing.isRemote && 'remote'].filter(Boolean);
    if (!modes.includes(body.service_mode)) fail(400, 'Esta forma de atendimento não está disponível neste anúncio.');
    if (body.service_mode === 'client_place' && !body.service_address) fail(422, 'Informe o endereço onde o serviço será feito.');

    const scheduledDate = new Date(`${body.date}T00:00:00.000Z`);
    const blockedDay = await tx.professionalAvailability.findFirst({ where: { professionalId: listing.ownerId, date: scheduledDate, isAvailable: false }, select: { id: true } });
    const dateError = bookingDateError(listing.availability, body.date, now, new Set(blockedDay ? [body.date] : []));
    if (dateError) fail(422, dateError);

    const duplicate = await tx.order.findFirst({ where: { listingId: listing.id, clientId: userId, scheduledDate, status: { in: ['requested', 'accepted', 'in_progress'] } }, select: { id: true } });
    if (duplicate) fail(409, 'Você já solicitou este serviço para essa data.');

    // Horário (por hora) e intervalo de datas (por diária), com a mesma regra que a tela usa.
    const quantity = normalizeQuantity(listing.pricingModel, body.quantity);
    const window = (listing.availability?.weekdays ?? []).find((day) => day.day === weekdayOf(body.date));
    const slotProblem = slotError(listing.pricingModel, { time: body.time, quantity }, window);
    if (slotProblem) fail(422, slotProblem);
    let endDate = null;
    if (listing.pricingModel === 'daily' && quantity > 1) {
      endDate = addDays(body.date, quantity - 1);
      const blockedRows = await tx.professionalAvailability.findMany({ where: { professionalId: listing.ownerId, isAvailable: false, date: { gte: scheduledDate, lte: new Date(`${endDate}T00:00:00.000Z`) } }, select: { date: true } });
      const blockedSet = new Set(blockedRows.map((row) => row.date.toISOString().slice(0, 10)));
      for (const day of daysOf(body.date, quantity).slice(1)) {
        const problem = bookingDateError(listing.availability, day, now, blockedSet);
        if (problem) fail(422, `Em ${brDate(day)}: ${problem}`);
      }
    }
    // Serializa os pedidos do mesmo anúncio para dois clientes não pegarem o mesmo horário.
    await tx.$queryRaw`SELECT id FROM listings WHERE id = ${listing.id} FOR UPDATE`;
    const taken = await tx.order.findMany({ where: { listingId: listing.id, status: { in: ['accepted', 'in_progress'] }, scheduledDate: { gte: scheduledDate } }, select: { pricingModelSnapshot: true, scheduledDate: true, scheduledTime: true, quantity: true } });
    const candidate = { pricingModel: listing.pricingModel, date: body.date, time: body.time, quantity: quantity ?? 1 };
    if (hasConflict(candidate, taken.map((row) => ({ pricingModel: row.pricingModelSnapshot, date: row.scheduledDate.toISOString().slice(0, 10), time: row.scheduledTime, quantity: row.quantity ?? 1 })))) {
      fail(409, listing.pricingModel === 'hourly' ? 'Este horário acabou de ser ocupado. Escolha outro.' : 'Estas datas acabaram de ser ocupadas. Escolha outras.');
    }

    const amounts = computeAmounts(listing, { packageName: body.package_name, serviceMode: body.service_mode, quantity });
    const order = await tx.order.create({
      data: {
        uuid: generateUuid(), listingId: listing.id, clientId: userId, professionalId: listing.ownerId, scheduledDate, serviceMode: body.service_mode,
        packageName: body.package_name || null, note: body.note || null, scheduledTime: listing.pricingModel === 'hourly' ? body.time : null,
        endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`) : null, quantity, ...(body.image_urls?.length && { referenceImages: body.image_urls }), ...(body.service_mode === 'client_place' && body.service_address && { serviceAddress: body.service_address }), titleSnapshot: listing.title, pricingModelSnapshot: listing.pricingModel,
        priceSnapshot: amounts.price, travelFeeSnapshot: amounts.travelFee, policySnapshot: listing.cancellationPolicy, platformFeePercent: platformFeePercent(),
      },
    });
    const uuid = bufferToUuid(order.uuid);
    await notify(tx, emails, listing.ownerId, `order-requested:${uuid}`, `${nameOf(client)} pediu "${listing.title}" para ${brDate(body.date)}.`, `/contratacoes/${uuid}`, 'order_received');
    return { uuid };
  });
}

const MESSAGES = {
  accept: (order, actor) => `${actor} aceitou o seu pedido "${order.titleSnapshot}" para ${brDate(order.scheduledDate)}.`,
  decline: (order, actor) => `${actor} não pôde atender ao pedido "${order.titleSnapshot}".`,
  start: (order) => `O serviço "${order.titleSnapshot}" foi iniciado.`,
  cancel: (order, actor) => `${actor} cancelou o pedido "${order.titleSnapshot}".`,
};

export async function transitionOrder(uuid, userId, action, body = {}) {
  return runTransaction(async (tx, emails) => {
    const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
    if (!user) fail(401, 'Conta indisponível. Entre novamente.');
    const order = await lockedOrder(tx, uuid);
    const { to, role } = resolveTransition(order, userId, action);
    const now = new Date();
    // Contratação de proposta: o valor é o da proposta aceita, não um valor digitado na hora de concluir.
    if (order.serviceId && to === 'completed') body = { ...body, final_amount: Number(order.priceSnapshot) };
    const data = {
      status: to,
      ...(to === 'accepted' && { acceptedAt: now }),
      ...(to === 'in_progress' && { startedAt: now }),
      ...(to === 'completed' && { completedAt: now, finalAmount: body.final_amount }),
      ...(to === 'cancelled' && { cancelledAt: now, cancelledById: userId }),
    };
    if (action === 'accept' && ['hourly', 'daily'].includes(order.pricingModelSnapshot)) {
      // Dois pedidos para o mesmo horário: só o primeiro aceito vale.
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${order.listingId} FOR UPDATE`;
      const others = await tx.order.findMany({ where: { listingId: order.listingId, id: { not: order.id }, status: { in: ['accepted', 'in_progress'] }, scheduledDate: { gte: order.scheduledDate } }, select: { pricingModelSnapshot: true, scheduledDate: true, scheduledTime: true, quantity: true } });
      const mine = { pricingModel: order.pricingModelSnapshot, date: order.scheduledDate.toISOString().slice(0, 10), time: order.scheduledTime, quantity: order.quantity ?? 1 };
      if (hasConflict(mine, others.map((row) => ({ pricingModel: row.pricingModelSnapshot, date: row.scheduledDate.toISOString().slice(0, 10), time: row.scheduledTime, quantity: row.quantity ?? 1 })))) fail(409, 'Este horário já foi aceito para outro cliente. Recuse este pedido.');
    }
    await tx.order.update({ where: { id: order.id }, data });
    await syncPaymentsWithOrder(tx, order, to, to === 'completed' ? body.final_amount : null);
    // O pedido aberto acompanha a contratação nascida da proposta.
    if (order.serviceId && ['completed', 'cancelled'].includes(to)) await tx.service.update({ where: { id: order.serviceId }, data: { status: to } });

    const orderUuid = bufferToUuid(order.uuid);
    const actor = nameOf(role === 'professional' ? order.professional : order.client);
    const other = role === 'professional' ? order.clientId : order.professionalId;
    if (action === 'complete') {
      for (const recipient of [order.clientId, order.professionalId]) {
        await notify(tx, emails, recipient, `order-completed:${orderUuid}:${recipient}`, `O serviço "${order.titleSnapshot}" foi concluído. Conte como foi sua experiência.`, order.service ? `/servicos/${bufferToUuid(order.service.uuid)}/avaliar` : `/contratacoes/${orderUuid}/avaliar`, 'service_completed');
      }
    } else {
      await notify(tx, emails, other, `order-${to}:${orderUuid}`, MESSAGES[action](order, actor), `/contratacoes/${orderUuid}`, 'order_update');
    }
    return { status: to };
  });
}

function reviewTarget(order, userId) {
  if (order.clientId === userId) return order.professional;
  if (order.professionalId === userId) return order.client;
  return fail(403, 'Somente os participantes podem avaliar este serviço.');
}

export async function orderReviewContext(uuid, userId) {
  return runTransaction(async (tx) => {
    const order = await lockedOrder(tx, uuid);
    const target = reviewTarget(order, userId);
    const existing = await tx.review.findFirst({ where: { orderId: order.id, reviewerId: userId, reviewedId: target.id }, select: { rating: true } });
    return {
      title: order.titleSnapshot, status: order.status, isClient: order.clientId === userId,
      target: { uuid: bufferToUuid(target.uuid), name: nameOf(target) },
      alreadyReviewed: !!existing, canReview: order.status === 'completed' && !existing,
    };
  });
}

async function refreshProfessionalRating(tx, professionalId) {
  await tx.$queryRaw`SELECT user_id FROM professional_profiles WHERE user_id = ${professionalId} FOR UPDATE`;
  const stats = await tx.review.aggregate({
    where: { reviewedId: professionalId, OR: [{ service: { proposals: { some: { professionalId, status: 'accepted' } } } }, { order: { professionalId } }] },
    _avg: { rating: true }, _count: { rating: true },
  });
  await tx.professionalProfile.update({ where: { userId: professionalId }, data: { averageRating: stats._avg.rating ?? 0, totalReviews: stats._count.rating } });
}

export async function submitOrderReview(uuid, userId, body) {
  return runTransaction(async (tx, emails) => {
    const order = await lockedOrder(tx, uuid);
    const target = reviewTarget(order, userId);
    if (order.status !== 'completed') fail(409, 'Só é possível avaliar depois da conclusão do serviço.');
    const review = await tx.review.create({ data: { orderId: order.id, reviewerId: userId, reviewedId: target.id, rating: body.rating, comment: body.comment } });
    const reviewerIsClient = order.clientId === userId;
    if (reviewerIsClient) await refreshProfessionalRating(tx, target.id);
    const orderUuid = bufferToUuid(order.uuid);
    await notify(tx, emails, target.id, `order-review:${orderUuid}:${userId}`, `Você recebeu uma avaliação de ${review.rating}/5 pelo serviço "${order.titleSnapshot}".`, reviewerIsClient ? '/perfil/avaliacoes' : `/contratacoes/${orderUuid}`, 'review_received');
    return { rating: review.rating, comment: review.comment };
  });
}

/** Recalcula a nota do profissional (usado quando o fluxo antigo de propostas também gera avaliações). */
export { refreshProfessionalRating };
