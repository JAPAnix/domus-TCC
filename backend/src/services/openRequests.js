import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { runTransaction, notify } from './serviceWorkflow.js';
import { writeAudit } from './adminService.js';
import { asaasActive } from './payoutAccounts.js';
import { openRequestConfig } from '../config/openRequests.js';
import { maskContacts } from '../utils/contactMask.js';
import { REPORT_REASONS, canTransition, proposalBlockers, meetsPreferences, planRequestExpiry, timeLeftText } from '../utils/openRequestRules.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86400000, HOUR = 3600000;
const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');

// ---- Publicar, editar e renovar (cliente) -------------------------------------------------------------------------

/** Aplica o mascaramento de contato ao título e à descrição. Devolve também se algo foi escondido. */
export function cleanRequestText({ title, description }) {
  const t = title == null ? null : maskContacts(title);
  const d = description == null ? null : maskContacts(description);
  return { title: t?.text, description: d?.text, masked: !!(t?.masked || d?.masked) };
}

export async function createOpenRequest(userId, body, now = new Date(), db = prisma) {
  const config = openRequestConfig();
  const today = await db.service.count({ where: { clientId: userId, createdAt: { gte: new Date(now.getTime() - DAY) }, status: { not: 'draft' } } });
  if (today >= config.maxPerDay) fail(429, `Você já publicou ${config.maxPerDay} pedidos nas últimas 24 horas. Tente de novo amanhã ou renove um pedido que já existe.`);
  const active = await db.service.count({ where: { clientId: userId, deletedAt: null, status: 'open' } });
  if (active >= config.maxActive) fail(409, `Você já tem ${config.maxActive} pedidos abertos. Cancele ou conclua algum antes de publicar outro.`);
  const days = body.valid_days ?? config.defaultDays;
  if (!config.validityDays.includes(days)) fail(400, 'Escolha uma validade de 3, 7, 15 ou 30 dias.');
  const cleaned = cleanRequestText(body);
  const service = await db.service.create({
    data: {
      uuid: generateUuid(), clientId: userId, categoryId: body.category_id, title: cleaned.title, description: cleaned.description,
      budgetMin: body.budget_min, budgetMax: body.budget_max, deadline: body.deadline, city: body.city, state: body.state, neighborhood: body.neighborhood || null,
      status: 'open', expiresAt: new Date(now.getTime() + days * DAY), maxProposals: config.maxProposals,
      onlyVerified: !!body.only_verified, minRating: body.min_rating ?? null, modes: body.modes?.length ? body.modes : null,
      ...(body.image_urls?.length && { images: { create: body.image_urls.map((url, sortOrder) => ({ url, sortOrder })) } }),
    },
    include: { category: true, images: { orderBy: { sortOrder: 'asc' }, select: { url: true } } },
  });
  await db.serviceDraft.deleteMany({ where: { userId } });
  return { service, masked: cleaned.masked };
}

/** Renova a validade de um pedido aberto ou expirado, a partir de agora. */
export async function renewOpenRequest(uuid, userId, days, now = new Date()) {
  const config = openRequestConfig();
  if (!config.validityDays.includes(days)) fail(400, 'Escolha uma validade de 3, 7, 15 ou 30 dias.');
  return runTransaction(async (tx) => {
    const service = await lockedRequest(tx, uuid);
    if (service.clientId !== userId) fail(403, 'Acesso negado.');
    if (!['open', 'expired'].includes(service.status)) fail(409, 'Só dá para renovar um pedido aberto ou expirado.');
    if (service.status === 'expired') {
      const active = await tx.service.count({ where: { clientId: userId, deletedAt: null, status: 'open' } });
      if (active >= config.maxActive) fail(409, `Você já tem ${config.maxActive} pedidos abertos. Cancele ou conclua algum antes de renovar este.`);
    }
    await tx.service.update({ where: { id: service.id }, data: { status: 'open', expiresAt: new Date(now.getTime() + days * DAY) } });
    return { status: 'open', expiresAt: new Date(now.getTime() + days * DAY) };
  });
}

async function lockedRequest(tx, uuid) {
  if (!UUID.test(uuid)) fail(400, 'Pedido inválido.');
  const id = uuidToBuffer(uuid);
  await tx.$queryRaw`SELECT id FROM services WHERE uuid = ${id} FOR UPDATE`;
  const service = await tx.service.findFirst({ where: { uuid: id, deletedAt: null } });
  if (!service) fail(404, 'Pedido não encontrado.');
  return service;
}

// ---- Rascunho do passo a passo ------------------------------------------------------------------------------------
export const getDraft = async (userId, db = prisma) => (await db.serviceDraft.findUnique({ where: { userId } }))?.data ?? null;
export async function saveDraft(userId, data, db = prisma) {
  const text = JSON.stringify(data ?? {});
  if (text.length > 20000) fail(413, 'O rascunho ficou grande demais.');
  await db.serviceDraft.upsert({ where: { userId }, create: { userId, data }, update: { data } });
  return { ok: true };
}
export const clearDraft = (userId, db = prisma) => db.serviceDraft.deleteMany({ where: { userId } });

// ---- Quem pode propor ---------------------------------------------------------------------------------------------
export async function blockersFor(userId, db = prisma) {
  const profile = await db.professionalProfile.findUnique({ where: { userId }, select: { displayName: true, headline: true, bio: true } });
  const payout = asaasActive() ? await db.payoutAccount.findUnique({ where: { userId }, select: { status: true } }) : null;
  return proposalBlockers({
    hasProfile: !!profile, profileComplete: !!(profile && (profile.displayName || profile.headline || profile.bio)),
    asaasActive: asaasActive(), payoutStatus: payout?.status,
  });
}

export { meetsPreferences };

// ---- Oportunidades (profissional) ---------------------------------------------------------------------------------
async function scopeOf(db, userId) {
  const [profile, listings, blocks] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId }, select: { isVerified: true, averageRating: true } }),
    db.listing.findMany({ where: { ownerId: userId, deletedAt: null, status: { in: ['published', 'paused'] } }, select: { categoryId: true, state: true } }),
    db.userBlock.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } }),
  ]);
  return {
    profile,
    categoryIds: [...new Set(listings.map((item) => item.categoryId).filter((id) => id != null))],
    states: [...new Set(listings.map((item) => item.state).filter(Boolean))],
    hasListing: listings.length > 0,
    blocked: [...new Set(blocks.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)))],
  };
}

/** Condição de busca das oportunidades de um profissional: pedidos abertos, de outras pessoas, que ele pode atender. */
export function opportunityWhere(userId, scope, filters = {}, now = new Date()) {
  const and = [
    { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    { NOT: { views: { some: { userId, dismissedAt: { not: null } } } } },
  ];
  if (!scope.profile?.isVerified) and.push({ onlyVerified: false });
  and.push({ OR: [{ minRating: null }, { minRating: { lte: Number(scope.profile?.averageRating ?? 0) } }] });
  if (scope.hasListing) {
    if (scope.categoryIds.length) and.push({ categoryId: { in: scope.categoryIds } });
    if (scope.states.length) and.push({ OR: [{ state: { in: scope.states } }, { state: null }] });
  }
  if (filters.category_id) and.push({ categoryId: Number(filters.category_id) });
  if (filters.state) and.push({ state: String(filters.state).toUpperCase() });
  if (filters.city) and.push({ city: String(filters.city) });
  if (filters.budget_min) and.push({ OR: [{ budgetMax: null }, { budgetMax: { gte: Number(filters.budget_min) } }] });
  if (filters.budget_max) and.push({ OR: [{ budgetMin: null }, { budgetMin: { lte: Number(filters.budget_max) } }] });
  if (filters.date_until) and.push({ OR: [{ deadline: null }, { deadline: { lte: new Date(`${filters.date_until}T00:00:00.000Z`) } }] });
  if (filters.urgency === 'soon') and.push({ expiresAt: { lte: new Date(now.getTime() + 48 * HOUR) } });
  if (filters.only_new === 'true' || filters.only_new === true) and.push({ NOT: { views: { some: { userId } } } });
  return { deletedAt: null, status: 'open', client: { deactivatedAt: null }, clientId: { notIn: [userId, ...scope.blocked] }, AND: and };
}

const ORDERS = { recent: { createdAt: 'desc' }, expiring: { expiresAt: 'asc' }, budget: { budgetMax: 'desc' } };

export async function listOpportunities(userId, query = {}, now = new Date(), db = prisma) {
  const scope = await scopeOf(db, userId);
  const page = Math.max(1, Number(query.page) || 1), limit = Math.min(30, Math.max(1, Number(query.limit) || 12));
  const where = opportunityWhere(userId, scope, query, now);
  const [rows, total] = await db.$transaction([
    db.service.findMany({
      where, orderBy: [ORDERS[query.order] ?? ORDERS.recent, { id: 'desc' }], skip: (page - 1) * limit, take: limit,
      include: {
        category: { select: { id: true, name: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        client: { select: { uuid: true, firstName: true, lastName: true, preferredName: true } },
        views: { where: { userId }, select: { firstSeenAt: true } },
        proposals: { select: { status: true, professionalId: true } },
      },
    }),
    db.service.count({ where }),
  ]);
  return {
    data: rows.map((row) => serializeOpportunity(row, userId, now)),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
    needsListing: !scope.hasListing,
    blockers: await blockersFor(userId, db),
  };
}

export function serializeOpportunity(row, userId, now = new Date()) {
  const counted = row.proposals.filter((proposal) => proposal.status === 'pending' || proposal.status === 'accepted').length;
  const mine = row.proposals.find((proposal) => proposal.professionalId === userId);
  const hoursLeft = row.expiresAt ? Math.max(0, Math.ceil((row.expiresAt.getTime() - now.getTime()) / HOUR)) : null;
  return {
    uuid: bufferToUuid(row.uuid), title: row.title, description: row.description.length > 220 ? `${row.description.slice(0, 217)}…` : row.description,
    category: row.category, city: row.city, state: row.state, neighborhood: row.neighborhood, deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : null,
    budgetMin: row.budgetMin == null ? null : Number(row.budgetMin), budgetMax: row.budgetMax == null ? null : Number(row.budgetMax),
    cover: row.images?.[0]?.url ?? null, createdAt: row.createdAt, expiresAt: row.expiresAt, hoursLeft,
    proposalsCount: counted, maxProposals: row.maxProposals, limitReached: counted >= row.maxProposals,
    isNew: !row.views?.length, myProposalStatus: mine?.status ?? null,
    client: { uuid: bufferToUuid(row.client.uuid), name: nameOf(row.client) },
  };
}

export async function opportunityCount(userId, now = new Date(), db = prisma) {
  const scope = await scopeOf(db, userId);
  const isPro = !!scope.profile;
  if (!isPro) return 0;
  return db.service.count({ where: opportunityWhere(userId, scope, { only_new: true }, now) });
}

export async function markSeen(userId, uuid, db = prisma) {
  if (!UUID.test(uuid)) return { ok: false };
  const service = await db.service.findFirst({ where: { uuid: uuidToBuffer(uuid), deletedAt: null }, select: { id: true } });
  if (!service) return { ok: false };
  await db.serviceView.upsert({ where: { userId_serviceId: { userId, serviceId: service.id } }, create: { userId, serviceId: service.id }, update: {} });
  return { ok: true };
}

export async function dismissOpportunity(userId, uuid, db = prisma) {
  if (!UUID.test(uuid)) fail(404, 'Pedido não encontrado.');
  const service = await db.service.findFirst({ where: { uuid: uuidToBuffer(uuid), deletedAt: null }, select: { id: true } });
  if (!service) fail(404, 'Pedido não encontrado.');
  const now = new Date();
  await db.serviceView.upsert({ where: { userId_serviceId: { userId, serviceId: service.id } }, create: { userId, serviceId: service.id, dismissedAt: now }, update: { dismissedAt: now } });
  return { ok: true };
}

/** Dados do cliente para o profissional decidir: nota e avaliações recebidas (nunca contato). */
export async function clientSummary(clientId, db = prisma) {
  const stats = await db.review.aggregate({ where: { reviewedId: clientId }, _avg: { rating: true }, _count: { rating: true } });
  return { rating: stats._avg.rating == null ? null : Math.round(stats._avg.rating * 10) / 10, reviews: stats._count.rating };
}

// ---- Denúncias e moderação ----------------------------------------------------------------------------------------
export async function reportRequest(userId, uuid, { reason, details, proposalUuid }, db = prisma) {
  if (!(reason in REPORT_REASONS)) fail(400, 'Escolha o motivo da denúncia.');
  if (!UUID.test(uuid)) fail(404, 'Pedido não encontrado.');
  const service = await db.service.findFirst({ where: { uuid: uuidToBuffer(uuid), deletedAt: null }, select: { id: true, clientId: true } });
  if (!service) fail(404, 'Pedido não encontrado.');
  let proposalId = null;
  if (proposalUuid) {
    if (!UUID.test(proposalUuid)) fail(404, 'Proposta não encontrada.');
    const proposal = await db.proposal.findFirst({ where: { uuid: uuidToBuffer(proposalUuid), serviceId: service.id }, select: { id: true, professionalId: true } });
    if (!proposal) fail(404, 'Proposta não encontrada.');
    if (proposal.professionalId === userId) fail(400, 'Você não pode denunciar a sua própria proposta.');
    // Só o dono do pedido denuncia propostas.
    if (service.clientId !== userId) fail(403, 'Só quem publicou o pedido pode denunciar as propostas.');
    proposalId = proposal.id;
  } else if (service.clientId === userId) fail(400, 'Você não pode denunciar o seu próprio pedido.');
  const duplicate = await db.serviceReport.findFirst({ where: { reporterId: userId, serviceId: service.id, proposalId, status: 'open' }, select: { id: true } });
  if (duplicate) return { ok: true, duplicate: true };
  await db.serviceReport.create({ data: { reporterId: userId, serviceId: service.id, proposalId, reason, details: details?.trim().slice(0, 500) || null } });
  return { ok: true };
}

export async function listReports({ status = 'open', page = 1, limit = 20 } = {}, db = prisma) {
  const where = status === 'all' ? {} : { status };
  const [rows, total] = await db.$transaction([
    db.serviceReport.findMany({
      where, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: { reporter: { select: { firstName: true, lastName: true, preferredName: true } }, service: { select: { uuid: true, title: true, description: true, status: true, client: { select: { firstName: true, lastName: true, preferredName: true } } } } },
    }),
    db.serviceReport.count({ where }),
  ]);
  const proposalIds = rows.map((row) => row.proposalId).filter(Boolean);
  const proposals = proposalIds.length ? await db.proposal.findMany({ where: { id: { in: proposalIds } }, select: { id: true, proposedPrice: true, coverLetter: true, included: true, status: true, professional: { select: { user: { select: { firstName: true, lastName: true, preferredName: true } } } } } }) : [];
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  return {
    data: rows.map((row) => {
      const proposal = row.proposalId ? byId.get(row.proposalId) : null;
      return {
        id: String(row.id), kind: row.proposalId ? 'proposal' : 'request', reason: row.reason, reasonLabel: REPORT_REASONS[row.reason] ?? row.reason, details: row.details, status: row.status,
        createdAt: row.createdAt, resolvedAt: row.resolvedAt, resolutionNote: row.resolutionNote, reporter: nameOf(row.reporter),
        service: { uuid: bufferToUuid(row.service.uuid), title: row.service.title, description: row.service.description.slice(0, 600), status: row.service.status, client: nameOf(row.service.client) },
        proposal: proposal ? { amount: Number(proposal.proposedPrice), text: proposal.coverLetter?.slice(0, 600) ?? null, included: proposal.included, status: proposal.status, professional: nameOf(proposal.professional.user) } : null,
      };
    }),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

/** O administrador remove o conteúdo denunciado (com aviso a quem o criou) ou ignora a denúncia. Tudo vai para a auditoria. */
export async function resolveReport(adminId, id, { action, note }) {
  if (!['remove', 'dismiss'].includes(action)) fail(400, 'Escolha remover ou ignorar a denúncia.');
  const text = String(note ?? '').trim();
  if (text.length < 5) fail(400, 'Escreva uma justificativa curta (mínimo 5 caracteres).');
  return runTransaction(async (tx, emails) => {
    await tx.$queryRaw`SELECT id FROM service_reports WHERE id = ${BigInt(id)} FOR UPDATE`;
    const report = await tx.serviceReport.findUnique({ where: { id: BigInt(id) } });
    if (!report) fail(404, 'Denúncia não encontrada.');
    if (report.status !== 'open') fail(409, 'Esta denúncia já foi decidida.');
    const service = await lockedRequest(tx, bufferToUuid((await tx.service.findUnique({ where: { id: report.serviceId }, select: { uuid: true } })).uuid));
    let outcome = 'dismissed';
    if (action === 'remove') {
      outcome = 'removed';
      if (report.proposalId) {
        const proposal = await tx.proposal.findUnique({ where: { id: report.proposalId } });
        if (proposal.status === 'accepted') fail(409, 'Esta proposta já foi aceita e virou um pedido em andamento. Resolva pelo pedido.');
        await tx.proposal.update({ where: { id: proposal.id }, data: { status: 'rejected' } });
        await notify(tx, emails, proposal.professionalId, `moderation-proposal:${proposal.id}`, `A sua proposta para "${service.title}" foi removida pela moderação do Dommos por não seguir as regras da comunidade.`, '/ajuda/artigo/regras-da-comunidade', 'order_update');
      } else {
        if (!canTransition(service.status, 'removed')) fail(409, 'Este pedido não pode mais ser removido (já está em andamento ou encerrado).');
        await tx.service.update({ where: { id: service.id }, data: { status: 'removed', removedAt: new Date(), removedReason: text.slice(0, 200) } });
        await tx.proposal.updateMany({ where: { serviceId: service.id, status: 'pending' }, data: { status: 'rejected' } });
        await notify(tx, emails, service.clientId, `moderation-request:${service.id}`, `O seu pedido "${service.title}" foi removido pela moderação do Dommos por não seguir as regras da comunidade.`, '/ajuda/artigo/regras-da-comunidade', 'order_update');
      }
    }
    await tx.serviceReport.updateMany({ where: report.proposalId ? { id: report.id } : { serviceId: service.id, proposalId: null, status: 'open' }, data: { status: outcome, resolvedById: adminId, resolvedAt: new Date(), resolutionNote: text.slice(0, 500) } });
    await writeAudit(tx, { adminId, action: action === 'remove' ? 'moderation.remove' : 'moderation.dismiss', targetType: report.proposalId ? 'proposal' : 'request', targetId: report.proposalId ?? service.id, detail: `${REPORT_REASONS[report.reason] ?? report.reason}: ${text}` });
    return { status: outcome };
  });
}

// ---- Rotinas agendadas --------------------------------------------------------------------------------------------
/** Avisa pedidos perto de vencer, expira os vencidos (e as propostas deles) e expira propostas vencidas. */
export async function runOpenRequestExpiry(now = new Date(), db = prisma) {
  const config = openRequestConfig();
  if (!config.enabled) return { expired: 0, warned: 0, proposalsExpired: 0 };
  const horizon = new Date(now.getTime() + config.warnHours * HOUR);
  const [services, proposals] = await Promise.all([
    db.service.findMany({ where: { status: 'open', expiresAt: { lte: horizon } }, select: { id: true, status: true, expiresAt: true }, take: 500 }),
    db.proposal.findMany({ where: { status: 'pending', validUntil: { lte: now }, service: { status: 'open' } }, select: { id: true, validUntil: true }, take: 500 }),
  ]);
  const plan = planRequestExpiry({ services, proposals }, now, config.warnHours);
  let expired = 0, warned = 0, proposalsExpired = 0;

  for (const id of plan.toExpire) {
    try {
      const done = await runTransaction(async (tx, emails) => {
        await tx.$queryRaw`SELECT id FROM services WHERE id = ${id} FOR UPDATE`;
        const service = await tx.service.findUnique({ where: { id } });
        if (!service || service.status !== 'open' || !service.expiresAt || service.expiresAt > now) return false;
        const pending = await tx.proposal.findMany({ where: { serviceId: id, status: 'pending' }, select: { id: true, professionalId: true } });
        await tx.service.update({ where: { id }, data: { status: 'expired' } });
        await tx.proposal.updateMany({ where: { serviceId: id, status: 'pending' }, data: { status: 'expired' } });
        const uuid = bufferToUuid(service.uuid);
        await notify(tx, emails, service.clientId, `request-expired:${uuid}`, `O seu pedido "${service.title}" venceu. Renove a validade para voltar a receber propostas.`, `/servicos/${uuid}`, 'order_update');
        for (const proposal of pending) await notify(tx, emails, proposal.professionalId, `request-expired:${uuid}:${proposal.professionalId}`, `O pedido "${service.title}" venceu e a sua proposta foi encerrada.`, '/pro/oportunidades', 'order_update');
        return true;
      });
      if (done) expired++;
    } catch (err) { logger.error('requests.expire', err); }
  }

  for (const item of plan.toWarn) {
    try {
      const sent = await runTransaction(async (tx, emails) => {
        const service = await tx.service.findUnique({ where: { id: item.id } });
        if (!service || service.status !== 'open') return false;
        const uuid = bufferToUuid(service.uuid);
        const key = `request-expiring:${uuid}:${service.expiresAt.getTime()}`;
        if (await tx.notification.findFirst({ where: { eventKey: key }, select: { id: true } })) return false;
        await notify(tx, emails, service.clientId, key, `O seu pedido "${service.title}" vence em ${timeLeftText(item.hoursLeft)}. Renove a validade se ainda precisa do serviço.`, `/servicos/${uuid}`, 'order_update');
        return true;
      });
      if (sent) warned++;
    } catch (err) { logger.error('requests.warn', err); }
  }

  for (const id of plan.proposalsToExpire) {
    try {
      const done = await runTransaction(async (tx, emails) => {
        await tx.$queryRaw`SELECT id FROM proposals WHERE id = ${id} FOR UPDATE`;
        const proposal = await tx.proposal.findUnique({ where: { id }, include: { service: { select: { uuid: true, title: true, clientId: true, status: true } } } });
        if (!proposal || proposal.status !== 'pending' || !proposal.validUntil || proposal.validUntil > now || proposal.service.status !== 'open') return false;
        await tx.proposal.update({ where: { id }, data: { status: 'expired' } });
        const uuid = bufferToUuid(proposal.service.uuid);
        await notify(tx, emails, proposal.professionalId, `proposal-expired:${bufferToUuid(proposal.uuid)}`, `A sua proposta para "${proposal.service.title}" venceu sem resposta. Você pode enviar outra se o pedido ainda estiver aberto.`, `/pro/oportunidades/${uuid}`, 'order_update');
        return true;
      });
      if (done) proposalsExpired++;
    } catch (err) { logger.error('requests.proposalExpire', err); }
  }
  return { expired, warned, proposalsExpired };
}

/**
 * Resumo de oportunidades: no máximo um aviso por profissional a cada `digestHours`, só se houver pedido novo compatível
 * ainda não visto. Respeita as preferências de notificação (tipo "new_opportunity").
 */
export async function runOpportunityDigest(now = new Date(), db = prisma) {
  const config = openRequestConfig();
  if (!config.enabled) return { notified: 0 };
  const cutoff = new Date(now.getTime() - config.digestHours * HOUR);
  const pros = await db.professionalProfile.findMany({ where: { OR: [{ opportunityDigestAt: null }, { opportunityDigestAt: { lte: cutoff } }], user: { deletedAt: null, deactivatedAt: null } }, select: { userId: true, opportunityDigestAt: true }, take: 200 });
  let notified = 0;
  for (const pro of pros) {
    try {
      const scope = await scopeOf(db, pro.userId);
      if (!scope.hasListing) continue;
      const since = pro.opportunityDigestAt ?? new Date(now.getTime() - DAY);
      const count = await db.service.count({ where: { ...opportunityWhere(pro.userId, scope, { only_new: true }, now), createdAt: { gt: since } } });
      if (!count) continue;
      await runTransaction(async (tx, emails) => {
        const bucket = Math.floor(now.getTime() / (config.digestHours * HOUR));
        await notify(tx, emails, pro.userId, `opportunity-digest:${pro.userId}:${bucket}`, count === 1 ? 'Há 1 pedido novo que combina com os seus serviços.' : `Há ${count} pedidos novos que combinam com os seus serviços.`, '/pro/oportunidades', 'new_opportunity');
        await tx.professionalProfile.update({ where: { userId: pro.userId }, data: { opportunityDigestAt: now } });
      });
      notified++;
    } catch (err) {
      // Evento repetido (P2002) ou falha passageira: tenta de novo na próxima rodada.
      if (err.code !== 'P2002') logger.error('requests.digest', err);
    }
  }
  return { notified };
}

let timer = null;
export function startOpenRequestJobs(intervalMs = 10 * 60 * 1000) {
  if (timer) return;
  timer = setInterval(() => {
    runOpenRequestExpiry().catch((err) => logger.error('requests.expiry', err));
    runOpportunityDigest().catch((err) => logger.error('requests.digestJob', err));
  }, intervalMs);
  timer.unref();
}
