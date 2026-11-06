import { prisma } from '../config/prisma.js';
import { runTransaction, notify } from './serviceWorkflow.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { busyOf } from '../utils/bookingSlots.js';
import { highlightFor, HIGHLIGHT_LABELS } from '../utils/highlightRules.js';
import { reviewIdsMatching } from '../utils/textSearch.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
export const REPORT_REASONS = { scam: 'Parece golpe ou fraude', inappropriate: 'Conteúdo impróprio', wrong_info: 'Informações erradas ou enganosas', duplicate: 'Anúncio repetido', other: 'Outro motivo' };

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Taxa e tempo de resposta do profissional nas conversas dos últimos 90 dias.
 * "Respondeu" = escreveu depois da primeira mensagem do cliente. Com menos de 3 conversas, não há dado confiável (null).
 */
export async function responseStats(ownerId, now = new Date()) {
  const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw`
    SELECT c.id AS id, fc.t AS client_at,
      (SELECT MIN(m.created_at) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id = c.professional_id AND m.created_at >= fc.t) AS reply_at
    FROM conversations c
    JOIN (SELECT conversation_id, sender_id, MIN(created_at) AS t FROM messages GROUP BY conversation_id, sender_id) fc
      ON fc.conversation_id = c.id AND fc.sender_id = c.client_id
    WHERE c.professional_id = ${ownerId} AND c.created_at >= ${since}`;
  const minutes = rows.filter((row) => row.reply_at).map((row) => (new Date(row.reply_at) - new Date(row.client_at)) / 60000);
  if (rows.length < 3) return { conversations: rows.length, responseRate: null, responseMinutes: null };
  return { conversations: rows.length, responseRate: minutes.length / rows.length, responseMinutes: minutes.length ? Math.round(median(minutes)) : null };
}

/** Dados do profissional para a página do anúncio, incluindo o selo de destaque. */
export async function ownerPageData(ownerId, rating, reviews) {
  const stats = await responseStats(ownerId);
  const badge = highlightFor({ rating, reviews, responseRate: stats.responseRate, conversations: stats.conversations });
  return {
    responseRate: stats.responseRate == null ? null : Math.round(stats.responseRate * 100),
    responseMinutes: stats.responseMinutes,
    badge: badge ? { key: badge, ...HIGHLIGHT_LABELS[badge] } : null,
  };
}

/** Datas e horários já ocupados por pedidos aceitos (por hora e por diária) a partir de hoje. */
export async function busyForListing(listingId, from = new Date()) {
  const today = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  const orders = await prisma.order.findMany({
    where: { listingId, status: { in: ['accepted', 'in_progress'] }, pricingModelSnapshot: { in: ['hourly', 'daily'] }, scheduledDate: { gte: today } },
    select: { pricingModelSnapshot: true, scheduledDate: true, scheduledTime: true, quantity: true },
  });
  return busyOf(orders.map((order) => ({ pricingModel: order.pricingModelSnapshot, date: order.scheduledDate.toISOString().slice(0, 10), time: order.scheduledTime, quantity: order.quantity ?? 1 })));
}

const TOPICS = [
  ['Pontualidade', /pontual|no hor[aá]rio|chegou (cedo|na hora)|n[aã]o atrasou/i],
  ['Qualidade do serviço', /qualidade|bem feito|capricho|perfeito|excelente/i],
  ['Limpeza', /limp/i],
  ['Atendimento', /atencios|educad|simp[aá]tic|gentil|cuidados/i],
  ['Preço justo', /pre[cç]o|barato|custo|or[cç]amento/i],
  ['Rapidez', /r[aá]pid|[aá]gil|veloz/i],
  ['Comunicação', /comunic|respond|explic/i],
  ['Profissionalismo', /profissional/i],
];

async function listingByUuid(uuid) {
  if (!UUID.test(uuid)) fail(404, 'Anúncio não encontrado.');
  const listing = await prisma.listing.findFirst({ where: { uuid: uuidToBuffer(uuid), status: 'published', deletedAt: null }, select: { id: true, ownerId: true } });
  if (!listing) fail(404, 'Anúncio não encontrado.');
  return listing;
}

/** Avaliações dos serviços contratados neste anúncio, com resumo (média, histograma, assuntos), busca e ordenação. */
export async function listingReviews(uuid, { sort = 'recent', q = '', page = 1, limit = 10 }) {
  const listing = await listingByUuid(uuid);
  const base = { reviewedId: listing.ownerId, order: { listingId: listing.id, professionalId: listing.ownerId } };
  const term = q.trim().slice(0, 60);
  const where = { ...base, ...(term && { id: { in: await reviewIdsMatching(prisma, listing.ownerId, term) } }) };
  const orderBy = sort === 'best' ? [{ rating: 'desc' }, { createdAt: 'desc' }] : sort === 'worst' ? [{ rating: 'asc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }, { id: 'desc' }];
  const [rows, total, all] = await prisma.$transaction([
    prisma.review.findMany({
      where, orderBy, skip: (page - 1) * limit, take: limit,
      include: { reviewer: { select: { uuid: true, firstName: true, lastName: true, preferredName: true, profilePictureUrl: true, createdAt: true } }, order: { select: { titleSnapshot: true, packageName: true } } },
    }),
    prisma.review.count({ where }),
    prisma.review.findMany({ where: base, select: { rating: true, comment: true } }),
  ]);
  const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of all) histogram[item.rating] += 1;
  const average = all.length ? all.reduce((sum, item) => sum + item.rating, 0) / all.length : 0;
  const topics = TOPICS
    .map(([label, pattern]) => ({ label, count: all.filter((item) => item.comment && item.rating >= 4 && pattern.test(item.comment)).length }))
    .filter((topic) => topic.count >= 2).sort((a, b) => b.count - a.count).slice(0, 6);
  return {
    summary: { average: Math.round(average * 100) / 100, count: all.length, histogram, topics },
    data: rows.map((row) => ({
      id: row.id.toString(), rating: row.rating, comment: row.comment, createdAt: row.createdAt, reply: row.reply, repliedAt: row.repliedAt,
      serviceTitle: row.order?.titleSnapshot ?? null, packageName: row.order?.packageName ?? null,
      reviewer: { uuid: bufferToUuid(row.reviewer.uuid), name: nameOf(row.reviewer), profilePictureUrl: row.reviewer.profilePictureUrl, memberSince: row.reviewer.createdAt },
    })),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

/** Só o profissional avaliado responde, uma única vez. */
export async function replyToReview(userId, reviewId, text) {
  if (!/^\d{1,18}$/.test(String(reviewId))) fail(404, 'Avaliação não encontrada.');
  const reply = String(text ?? '').trim();
  if (reply.length < 2 || reply.length > 500) fail(400, 'A resposta precisa ter de 2 a 500 caracteres.');
  return runTransaction(async (tx, emails) => {
    const review = await tx.review.findFirst({ where: { id: BigInt(reviewId), reviewedId: userId, orderId: { not: null } }, include: { order: { select: { uuid: true, titleSnapshot: true, professionalId: true } } } });
    if (!review || review.order?.professionalId !== userId) fail(404, 'Avaliação não encontrada.');
    if (review.reply) fail(409, 'Você já respondeu a esta avaliação.');
    await tx.review.update({ where: { id: review.id }, data: { reply, repliedAt: new Date() } });
    await notify(tx, emails, review.reviewerId, `review-reply:${review.id}`, `O profissional respondeu à sua avaliação de "${review.order.titleSnapshot}".`, `/contratacoes/${bufferToUuid(review.order.uuid)}`, 'review_received');
    return { reply };
  });
}

export async function reportListing(userId, uuid, { reason, details }) {
  if (!(reason in REPORT_REASONS)) fail(400, 'Escolha o motivo da denúncia.');
  const listing = await listingByUuid(uuid);
  if (listing.ownerId === userId) fail(400, 'Este é o seu anúncio.');
  try {
    await prisma.listingReport.create({ data: { listingId: listing.id, reporterId: userId, reason, details: details?.trim().slice(0, 500) || null } });
  } catch (err) {
    if (err.code === 'P2002') fail(409, 'Você já denunciou este anúncio. Obrigado, vamos analisar.');
    throw err;
  }
  return { ok: true };
}
