import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';

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
export async function submitProposal(uuid, userId, body) {
  return runTransaction(async (tx, emails) => {
    await activeUser(tx, userId);
    const service = await lockedService(tx, uuid);
    if (service.status !== 'open') fail(409, 'O serviço não está aceitando propostas.');
    if (service.clientId === userId) fail(400, 'Você não pode enviar proposta no próprio serviço.');
    if (await blockedBetween(tx, userId, service.clientId)) fail(403, 'Não é possível enviar proposta para este pedido.');
    const proposal = await tx.proposal.create({ data: {
      uuid: generateUuid(), serviceId: service.id, professionalId: userId,
      proposedPrice: body.proposed_price, coverLetter: body.cover_letter, deliveryTimeDays: body.delivery_time_days, status: 'pending'
    } });
    await notify(tx, emails, service.clientId, 'proposal:' + bufferToUuid(proposal.uuid), 'Você recebeu uma nova proposta para "' + service.title + '".', '/servicos/' + uuid + '/propostas', 'proposal_received');
    return { ...proposal, uuid: bufferToUuid(proposal.uuid) };
  });
}

export async function decideProposal(uuid, userId, status) {
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
    await tx.proposal.update({ where: { id: proposal.id }, data: { status } });
    if (status === 'accepted') {
      await tx.service.update({ where: { id: service.id }, data: { status: 'in_progress' } });
      await tx.proposal.updateMany({ where: { serviceId: service.id, id: { not: proposal.id }, status: 'pending' }, data: { status: 'rejected' } });
      await notify(tx, emails, proposal.professionalId, 'accepted:' + uuid, 'Sua proposta para "' + service.title + '" foi aceita!', '/servicos/' + serviceUuid, 'proposal_accepted');
    }
    return { status };
  });
}

export async function changeServiceStatus(uuid, userId, status) {
  return runTransaction(async (tx, emails) => {
    await activeUser(tx, userId);
    const service = await lockedService(tx, uuid);
    if (service.clientId !== userId) fail(403, 'Somente o cliente pode concluir o serviço.');
    const allowed = { draft: ['open', 'cancelled'], open: ['cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [] };
    if (!allowed[service.status]?.includes(status)) fail(409, 'Transição não permitida. Para iniciar o serviço, aceite uma proposta.');
    if (status === 'completed' && service.proposals.length !== 1) fail(409, 'O serviço precisa ter exatamente uma proposta aceita.');
    await tx.service.update({ where: { id: service.id }, data: { status } });
    if (status === 'cancelled') await tx.proposal.updateMany({ where: { serviceId: service.id, status: 'pending' }, data: { status: 'rejected' } });
    if (status === 'completed') {
      for (const recipient of [service.clientId, service.proposals[0].professionalId]) {
        await notify(tx, emails, recipient, 'completed:' + uuid + ':' + recipient, 'O serviço "' + service.title + '" foi concluído. Conte como foi sua experiência.', '/servicos/' + uuid + '/avaliar', 'service_completed');
      }
    }
    return { status };
  });
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
