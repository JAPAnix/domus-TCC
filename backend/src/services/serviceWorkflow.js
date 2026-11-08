import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { cancelOrderForService, completeOrderForService, createOrderForProposal } from './proposalOrders.js';
import { openRequestConfig } from '../config/openRequests.js';
import { meetsPreferences, countsTowardLimit } from '../utils/openRequestRules.js';
import { maskContacts } from '../utils/contactMask.js';
import { blockersFor } from './openRequests.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function reviewTarget(service, userId) {
  const accepted = service.proposals.find(p => p.status === 'accepted');
  if (!accepted) fail(409, 'Este serviço ainda não tem um profissional contratado.');
  if (service.clientId === userId) return accepted.professional.user;
  if (accepted.professionalId === userId) return service.client;
  fail(403, 'Somente os participantes podem avaliar este serviço.');
}

async function activeUser(tx, userId) {
  const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
  if (!user) fail(401, 'Conta indisponível. Entre novamente.');
}

async function lockedService(tx, uuid) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) fail(400, 'Serviço inválido.');
  const id = uuidToBuffer(uuid);
  await tx.$queryRaw`SELECT id FROM services WHERE uuid = ${id} FOR UPDATE`;
  const service = await tx.service.findFirst({
    where: { uuid: id, deletedAt: null },
    include: { client: { select: { id: true, uuid: true, firstName: true, lastName: true } },
      proposals: { where: { status: 'accepted' }, include: { professional: { include: { user: { select: { id: true, uuid: true, firstName: true, lastName: true } } } } } }
    }
  });
  if (!service) fail(404, 'Serviço não encontrado.');
  return service;
}

// ---- Notificações e e-mails ------------------------------------------------
// O envio de e-mail é injetado pelo app (setEmailDispatcher) e só acontece depois do commit.
let dispatchEmails = async () => {};
export function setEmailDispatcher(dispatcher) { dispatchEmails = dispatcher; }

/** Executa o trabalho em transação e envia os e-mails acumulados depois da confirmação. */
export async function runTransaction(work) {
  const emails = [];
  const result = await prisma.$transaction((tx) => work(tx, emails), { isolationLevel: 'ReadCommitted', timeout: 15000 });
  if (emails.length) Promise.resolve(dispatchEmails(emails)).catch(() => {});
  return result;
}

/** Cria a notificação no site e registra o e-mail, respeitando as preferências do destinatário. */
export async function notify(tx, emails, userId, eventKey, message, href, type) {
  const settings = tx.userSettings ? await tx.userSettings.findUnique({ where: { userId }, select: { notificationPreferences: true } }) : null;
  const stored = settings?.notificationPreferences?.[type];
  if (stored?.app !== false) await tx.notification.create({ data: { userId, eventKey, message, href } });
  if (stored?.email !== false) emails.push({ userId, type, message, href });
}

async function blockedBetween(tx, a, b) {
  if (!tx.userBlock) return false;
  return !!await tx.userBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } });
}

// ---- Fluxo de pedidos e propostas -----------------------------------------
/** Texto da proposta sem formas de contato: tudo se combina pela plataforma. */
function proposalText(body) {
  const cover = body.cover_letter == null ? null : maskContacts(body.cover_letter).text;
  const included = body.included ? maskContacts(String(body.included).trim().slice(0, 500)).text : null;
  return { cover, included };
}

export async function submitProposal(uuid, userId, body) {
  return runTransaction(async (tx, emails) => {
    await activeUser(tx, userId);
    const service = await lockedService(tx, uuid);
    const config = openRequestConfig();
    const now = new Date();
    if (service.status !== 'open' || (service.expiresAt && service.expiresAt <= now)) fail(409, 'O serviço não está aceitando propostas.');
    if (service.clientId === userId) fail(400, 'Você não pode enviar proposta no próprio serviço.');
    if (await blockedBetween(tx, userId, service.clientId)) fail(403, 'Não é possível enviar proposta para este pedido.');
    const profile = await tx.professionalProfile.findUnique({ where: { userId }, select: { isVerified: true, averageRating: true, displayName: true, headline: true, bio: true } });
    if (!profile) fail(403, 'Crie o seu perfil profissional para enviar propostas.');
    if (!meetsPreferences(service, profile)) fail(403, service.onlyVerified && !profile.isVerified ? 'Este pedido aceita só profissionais verificados.' : 'Este pedido pede uma nota mínima que você ainda não tem.');
    const blockers = await blockersFor(userId, tx);
    if (blockers.length) fail(403, blockers[0]);
    const existing = await tx.proposal.findUnique({ where: { serviceId_professionalId: { serviceId: service.id, professionalId: userId } } });
    if (existing && !['expired', 'withdrawn'].includes(existing.status)) fail(409, existing.status === 'pending' ? 'Você já enviou uma proposta para este pedido. Edite a proposta que já existe.' : 'Sua proposta para este pedido já foi respondida.');
    const used = await tx.proposal.count({ where: { serviceId: service.id, status: { in: ['pending', 'accepted'] } } });
    if (used >= service.maxProposals) fail(409, 'Limite de propostas atingido: este pedido já recebeu todas as propostas que aceita.');
    const text = proposalText(body);
    const data = {
      proposedPrice: body.proposed_price, coverLetter: text.cover, deliveryTimeDays: body.delivery_time_days, included: text.included,
      validUntil: new Date(now.getTime() + (body.valid_hours ?? config.proposalValidityHours) * 3600000), status: 'pending', editedAt: null,
    };
    const proposal = existing
      ? await tx.proposal.update({ where: { id: existing.id }, data })
      : await tx.proposal.create({ data: { uuid: generateUuid(), serviceId: service.id, professionalId: userId, ...data } });
    await notify(tx, emails, service.clientId, 'proposal:' + bufferToUuid(proposal.uuid) + (existing ? ':' + now.getTime() : ''), 'Você recebeu uma nova proposta para "' + service.title + '".', '/servicos/' + uuid + '/propostas', 'proposal_received');
    return { ...proposal, uuid: bufferToUuid(proposal.uuid) };
  });
}

/** Edita uma proposta que ainda não foi respondida. O cliente é avisado. */
export async function editProposal(uuid, userId, body) {
  return runTransaction(async (tx, emails) => {
    await activeUser(tx, userId);
    const initial = await tx.proposal.findFirst({ where: { uuid: uuidToBuffer(uuid) }, include: { service: { select: { uuid: true } } } });
    if (!initial || initial.professionalId !== userId) fail(404, 'Proposta não encontrada.');
    const service = await lockedService(tx, bufferToUuid(initial.service.uuid));
    const proposal = await tx.proposal.findUnique({ where: { id: initial.id } });
    const now = new Date();
    if (proposal.status !== 'pending' || service.status !== 'open' || (service.expiresAt && service.expiresAt <= now)) fail(409, 'Esta proposta não pode mais ser editada.');
    const text = proposalText(body);
    const updated = await tx.proposal.update({ where: { id: proposal.id }, data: {
      proposedPrice: body.proposed_price, coverLetter: text.cover, deliveryTimeDays: body.delivery_time_days, included: text.included,
      validUntil: new Date(now.getTime() + (body.valid_hours ?? openRequestConfig().proposalValidityHours) * 3600000), editedAt: now,
    } });
    await notify(tx, emails, service.clientId, 'proposal-edited:' + bufferToUuid(updated.uuid) + ':' + now.getTime(), 'Uma proposta para "' + service.title + '" foi atualizada.', '/servicos/' + bufferToUuid(initial.service.uuid) + '/propostas', 'proposal_received');
    return { ...updated, uuid: bufferToUuid(updated.uuid) };
  });
}

export async function decideProposal(uuid, userId, status) {
  const result = await decideProposalInner(uuid, userId, status);
  if (result.expired) fail(409, 'Esta proposta venceu. Peça ao profissional para enviar outra.');
  return result;
}

async function decideProposalInner(uuid, userId, status) {
  return runTransaction(async (tx, emails) => {
    await activeUser(tx, userId);
    const initial = await tx.proposal.findFirst({ where: { uuid: uuidToBuffer(uuid) }, include: { service: { select: { uuid: true } } } });
    if (!initial) fail(404, 'Proposta não encontrada.');
    const serviceUuid = bufferToUuid(initial.service.uuid);
    const service = await lockedService(tx, serviceUuid);
    const proposal = await tx.proposal.findUnique({ where: { id: initial.id } });
    if (proposal.status !== 'pending' || service.status !== 'open') fail(409, 'A proposta ou o serviço já foi atualizado. Recarregue a página.');
    const client = service.clientId === userId;
    if (!client && proposal.professionalId !== userId) fail(403, 'Acesso negado.');
    if (client ? !['accepted', 'rejected'].includes(status) : status !== 'withdrawn') fail(403, 'Ação não permitida.');
    // Proposta vencida: encerra aqui (a rotina ainda pode não ter passado) e avisa quem tentou decidir.
    if (client && proposal.validUntil && proposal.validUntil <= new Date()) {
      await tx.proposal.update({ where: { id: proposal.id }, data: { status: 'expired' } });
      return { expired: true };
    }
    await tx.proposal.update({ where: { id: proposal.id }, data: { status } });
    let orderUuid = null;
    if (status === 'accepted') {
      await tx.service.update({ where: { id: service.id }, data: { status: 'in_progress' } });
      const others = await tx.proposal.findMany({ where: { serviceId: service.id, id: { not: proposal.id }, status: 'pending' }, select: { uuid: true, professionalId: true } });
      await tx.proposal.updateMany({ where: { serviceId: service.id, id: { not: proposal.id }, status: 'pending' }, data: { status: 'rejected' } });
      for (const other of others) await notify(tx, emails, other.professionalId, 'proposal-lost:' + bufferToUuid(other.uuid), 'O cliente escolheu outra proposta para "' + service.title + '". Obrigado por participar, veja outras oportunidades.', '/pro/oportunidades', 'order_update');
      const order = await createOrderForProposal(tx, { service, proposal });
      orderUuid = bufferToUuid(order.uuid);
      await notify(tx, emails, proposal.professionalId, 'accepted:' + uuid, 'Sua proposta para "' + service.title + '" foi aceita! O cliente vai fazer o pagamento pela contratação.', '/contratacoes/' + orderUuid, 'proposal_accepted');
    }
    return { status, ...(orderUuid && { orderUuid }) };
  });
}

export async function changeServiceStatus(uuid, userId, status) {
  let cancelledOrder = null;
  const result = await runTransaction(async (tx, emails) => {
    await activeUser(tx, userId);
    const service = await lockedService(tx, uuid);
    if (service.clientId !== userId) fail(403, 'Somente o cliente pode concluir o serviço.');
    const allowed = { draft: ['open', 'cancelled'], open: ['cancelled'], expired: ['cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [], removed: [] };
    if (!allowed[service.status]?.includes(status)) fail(409, 'Transição não permitida. Para iniciar o serviço, aceite uma proposta.');
    if (status === 'completed' && service.proposals.length !== 1) fail(409, 'O serviço precisa ter exatamente uma proposta aceita.');
    await tx.service.update({ where: { id: service.id }, data: { status } });
    if (status === 'cancelled') await tx.proposal.updateMany({ where: { serviceId: service.id, status: 'pending' }, data: { status: 'rejected' } });
    // A contratação criada no aceite da proposta acompanha o pedido aberto.
    if (status === 'completed') await completeOrderForService(tx, service.id);
    if (status === 'cancelled') cancelledOrder = await cancelOrderForService(tx, service.id, userId);
    if (status === 'completed') {
      for (const recipient of [service.clientId, service.proposals[0].professionalId]) {
        await notify(tx, emails, recipient, 'completed:' + uuid + ':' + recipient, 'O serviço "' + service.title + '" foi concluído. Conte como foi sua experiência.', '/servicos/' + uuid + '/avaliar', 'service_completed');
      }
    }
    return { status };
  });
  if (cancelledOrder) {
    // Fora da transação: fala com o gateway para estornar o que foi pago, conforme a política.
    const { refundOnCancel } = await import('./asaasPayments.js');
    await refundOnCancel(bufferToUuid(cancelledOrder.uuid)).catch((error) => console.error('[PEDIDO] estorno do cancelamento falhou:', error?.message));
  }
  return result;
}

export async function getReviewContext(uuid, userId) {
  return runTransaction(async (tx) => {
    await activeUser(tx, userId);
    const service = await lockedService(tx, uuid);
    const target = reviewTarget(service, userId);
    const existing = await tx.review.findFirst({ where: { serviceId: service.id, reviewerId: userId, reviewedId: target.id }, select: { rating: true } });
    return { title: service.title, status: service.status, isClient: service.clientId === userId,
      target: { uuid: bufferToUuid(target.uuid), name: target.firstName + ' ' + target.lastName },
      alreadyReviewed: !!existing, canReview: service.status === 'completed' && !existing };
  });
}

export async function submitReview(uuid, userId, body) {
  return runTransaction(async (tx, emails) => {
    await activeUser(tx, userId);
    const service = await lockedService(tx, uuid);
    const target = reviewTarget(service, userId);
    if (service.status !== 'completed') fail(409, 'Só é possível avaliar depois da conclusão do serviço.');
    const review = await tx.review.create({ data: { serviceId: service.id, reviewerId: userId, reviewedId: target.id, rating: body.rating, comment: body.comment } });
    if (service.clientId === userId) {
      await tx.$queryRaw`SELECT user_id FROM professional_profiles WHERE user_id = ${target.id} FOR UPDATE`;
      const stats = await tx.review.aggregate({ where: { reviewedId: target.id, OR: [{ service: { proposals: { some: { professionalId: target.id, status: 'accepted' } } } }, { order: { professionalId: target.id } }] }, _avg: { rating: true }, _count: { rating: true } });
      await tx.professionalProfile.update({ where: { userId: target.id }, data: { averageRating: stats._avg.rating ?? 0, totalReviews: stats._count.rating } });
    }
    await notify(tx, emails, target.id, 'review:' + uuid + ':' + userId, 'Você recebeu uma avaliação de ' + review.rating + '/5 pelo serviço "' + service.title + '".', '/perfil/avaliacoes', 'review_received');
    return { rating: review.rating, comment: review.comment };
  });
}

export const workflowHandler = (operation, status = 200) => async (req, res, next) => {
  try { res.status(status).json(await operation(req.params.uuid, BigInt(req.user.id), req.body)); }
  catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 'P2002') return res.status(409).json({ message: 'Você já enviou este registro.' });
    next(err);
  }
};
