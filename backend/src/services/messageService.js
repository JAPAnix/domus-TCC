import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { isBlockedBetween } from '../utils/blocks.js';
import { logger } from '../utils/logger.js';
import {
  MESSAGE_LIMITS, REPORT_REASONS, cleanMessageText, fillTemplate, previewOf, scheduledDueAt, suggestReplies, withinSendWindow,
} from '../utils/messageRules.js';
import { isOnline, onTyping, publish } from './realtime.js';
import { dispatchEventEmails } from './eventEmails.js';
import { conversationIdsMatching } from '../utils/textSearch.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
const personSelect = { id: true, uuid: true, firstName: true, lastName: true, preferredName: true, profilePictureUrl: true, deletedAt: true, deactivatedAt: true };
const person = (user) => ({ uuid: bufferToUuid(user.uuid), name: nameOf(user), profilePictureUrl: user.profilePictureUrl });
const brDate = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value)).split('-').reverse().join('/');
const conversationInclude = { client: { select: personSelect }, professional: { select: personSelect }, listing: { select: { uuid: true, deletedAt: true } } };

const roleOf = (conversation, userId) => (conversation.clientId === userId ? 'client' : conversation.professionalId === userId ? 'professional' : null);
const field = (role, name) => `${role}${name}`; // ex.: field('client', 'LastReadAt') -> clientLastReadAt

async function loadConversation(db, uuid, userId) {
  if (!UUID.test(uuid)) fail(404, 'Conversa não encontrada.');
  const conversation = await db.conversation.findFirst({ where: { uuid: uuidToBuffer(uuid) }, include: conversationInclude });
  const role = conversation && roleOf(conversation, userId);
  if (!role) fail(404, 'Conversa não encontrada.');
  return { conversation, role, other: role === 'client' ? conversation.professional : conversation.client };
}

const sharesReceipts = async (db, userId) => {
  const settings = await db.userSettings.findUnique({ where: { userId }, select: { readReceipts: true } });
  return settings?.readReceipts ?? true;
};

// ---- Conversas ---------------------------------------------------------------------------------------------
export async function openConversation(userId, { listingUuid, orderUuid }) {
  let listingId, clientId, professionalId, title;
  if (orderUuid) {
    if (!UUID.test(orderUuid)) fail(404, 'Pedido não encontrado.');
    const order = await prisma.order.findFirst({ where: { uuid: uuidToBuffer(orderUuid), OR: [{ clientId: userId }, { professionalId: userId }] } });
    if (!order) fail(404, 'Pedido não encontrado.');
    ({ listingId, clientId, professionalId } = order);
    title = order.titleSnapshot;
  } else {
    if (!UUID.test(listingUuid ?? '')) fail(404, 'Serviço não encontrado.');
    const listing = await prisma.listing.findFirst({ where: { uuid: uuidToBuffer(listingUuid), status: 'published', deletedAt: null, owner: { deletedAt: null, deactivatedAt: null } } });
    if (!listing) fail(404, 'Serviço não encontrado.');
    if (listing.ownerId === userId) fail(400, 'Este é o seu próprio anúncio.');
    ({ id: listingId, ownerId: professionalId, title } = listing);
    clientId = userId;
  }
  if (await isBlockedBetween(prisma, clientId, professionalId)) fail(403, 'Não é possível conversar com esta pessoa.');
  const find = () => prisma.conversation.findFirst({ where: { listingId, clientId }, select: { uuid: true } });
  let conversation = await find();
  if (!conversation) {
    try { conversation = await prisma.conversation.create({ data: { uuid: generateUuid(), listingId, clientId, professionalId, title: title.slice(0, 120) }, select: { uuid: true } }); }
    catch (err) { if (err.code !== 'P2002') throw err; conversation = await find(); }
  }
  return { uuid: bufferToUuid(conversation.uuid) };
}

/** Não lidas por conversa: mensagens da outra pessoa depois da última leitura de quem pergunta. */
async function unreadMap(userId) {
  const rows = await prisma.$queryRaw`
    SELECT c.id AS id, COUNT(m.id) AS total FROM conversations c
    JOIN messages m ON m.conversation_id = c.id AND m.sender_id <> ${userId}
    WHERE (c.client_id = ${userId} AND (c.client_last_read_at IS NULL OR m.created_at > c.client_last_read_at))
       OR (c.professional_id = ${userId} AND (c.professional_last_read_at IS NULL OR m.created_at > c.professional_last_read_at))
    GROUP BY c.id`;
  return new Map(rows.map((row) => [BigInt(row.id), Number(row.total)]));
}

export async function unreadTotal(userId) {
  const counts = await unreadMap(userId);
  if (!counts.size) return 0;
  const active = await prisma.conversation.findMany({
    where: { id: { in: [...counts.keys()] }, OR: [{ clientId: userId, clientArchivedAt: null }, { professionalId: userId, professionalArchivedAt: null }] }, select: { id: true },
  });
  return active.reduce((sum, row) => sum + (counts.get(row.id) ?? 0), 0);
}

export async function listConversations(userId, { archived = false, q = '', page = 1, limit = 30 }) {
  const mine = (role) => ({ [`${role}Id`]: userId, [`${role}ArchivedAt`]: archived ? { not: null } : null });
  const term = q.trim().slice(0, 60);
  const where = {
    OR: [mine('client'), mine('professional')],
    ...(term && { id: { in: await conversationIdsMatching(prisma, userId, term) } }),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.conversation.findMany({ where, include: conversationInclude, orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.conversation.count({ where }),
  ]);
  const unread = await unreadMap(userId);
  const data = await Promise.all(rows.map(async (conversation) => {
    const role = roleOf(conversation, userId);
    const other = role === 'client' ? conversation.professional : conversation.client;
    return {
      uuid: bufferToUuid(conversation.uuid), title: conversation.title, listingUuid: conversation.listing && !conversation.listing.deletedAt ? bufferToUuid(conversation.listing.uuid) : null,
      other: person(other), role, lastMessageAt: conversation.lastMessageAt, preview: conversation.lastMessagePreview, unread: unread.get(conversation.id) ?? 0,
      archived: !!conversation[field(role, 'ArchivedAt')], createdAt: conversation.createdAt,
    };
  }));
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

function serializeMessage(message, viewerId, seenAt) {
  const mine = message.senderId === viewerId;
  return {
    uuid: bufferToUuid(message.uuid), mine, kind: message.kind, body: message.body, imageUrl: message.imageUrl, createdAt: message.createdAt,
    read: mine && !!seenAt && seenAt >= message.createdAt,
  };
}

const typingUntil = new Map();
const isTyping = (conversationId, userId) => (typingUntil.get(`${conversationId}:${userId}`) ?? 0) > Date.now();

export async function getConversation(userId, uuid, { before, limit = 40 } = {}) {
  const { conversation, role, other } = await loadConversation(prisma, uuid, userId);
  const receipts = await sharesReceipts(prisma, userId);
  const seenAt = receipts ? conversation[field(role === 'client' ? 'professional' : 'client', 'ReceiptAt')] : null;
  let cursor = {};
  if (before && UUID.test(before)) {
    const pivot = await prisma.message.findFirst({ where: { uuid: uuidToBuffer(before), conversationId: conversation.id }, select: { id: true } });
    if (pivot) cursor = { id: { lt: pivot.id } };
  }
  const rows = await prisma.message.findMany({ where: { conversationId: conversation.id, ...cursor }, orderBy: { id: 'desc' }, take: limit + 1 });
  const blocked = await isBlockedBetween(prisma, conversation.clientId, conversation.professionalId);
  const unavailable = !!(other.deletedAt || other.deactivatedAt);
  return {
    uuid, title: conversation.title, role, other: person(other),
    listingUuid: conversation.listing && !conversation.listing.deletedAt ? bufferToUuid(conversation.listing.uuid) : null,
    archived: !!conversation[field(role, 'ArchivedAt')], blocked, unavailable, canSend: !blocked && !unavailable,
    typing: isTyping(conversation.id, other.id), seenAt,
    hasMore: rows.length > limit,
    messages: rows.slice(0, limit).reverse().map((row) => serializeMessage(row, userId, seenAt)),
  };
}

// ---- Envio ----------------------------------------------------------------------------------------------------
async function notifyOffline(conversation, senderRole, senderName, preview) {
  const recipientRole = senderRole === 'client' ? 'professional' : 'client';
  const recipientId = conversation[`${recipientRole}Id`];
  if (isOnline(recipientId)) return;
  const last = conversation[field(recipientRole, 'EmailedAt')];
  if (last && Date.now() - last.getTime() < MESSAGE_LIMITS.emailEveryMs) return;
  await prisma.conversation.update({ where: { id: conversation.id }, data: { [field(recipientRole, 'EmailedAt')]: new Date() } });
  Promise.resolve(dispatchEventEmails([{ userId: recipientId, type: 'message_new', message: `${senderName} enviou uma mensagem: “${preview}”`, href: `/mensagens/${bufferToUuid(conversation.uuid)}` }])).catch(() => {});
}

/** Regras de envio compartilhadas entre a tela e as respostas programadas. */
async function deliver(conversation, senderId, { body, imageUrl = null, kind = 'text' }) {
  const senderRole = roleOf(conversation, senderId);
  const recipient = senderRole === 'client' ? conversation.professional : conversation.client;
  if (await isBlockedBetween(prisma, conversation.clientId, conversation.professionalId)) fail(403, 'Não é possível enviar mensagens para esta pessoa.');
  if (recipient.deletedAt || recipient.deactivatedAt) fail(409, 'Esta pessoa não está mais disponível.');
  const text = cleanMessageText(body);
  if (!text && !imageUrl) fail(400, 'Escreva uma mensagem ou envie uma foto.');
  if (text.length > MESSAGE_LIMITS.body) fail(400, `A mensagem pode ter no máximo ${MESSAGE_LIMITS.body} caracteres.`);

  const sender = senderRole === 'client' ? conversation.client : conversation.professional;
  const receipts = await sharesReceipts(prisma, senderId);
  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({ data: { uuid: generateUuid(), conversationId: conversation.id, senderId, kind, body: text, imageUrl } });
    const recipientRole = senderRole === 'client' ? 'professional' : 'client';
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now, lastMessagePreview: previewOf(text, !!imageUrl),
        [field(senderRole, 'LastReadAt')]: now, ...(receipts && { [field(senderRole, 'ReceiptAt')]: now }),
        [field(senderRole, 'ArchivedAt')]: null, [field(recipientRole, 'ArchivedAt')]: null,
      },
    });
    return created;
  });
  const dto = { uuid: bufferToUuid(message.uuid), kind, body: text, imageUrl, createdAt: message.createdAt, senderUuid: bufferToUuid(sender.uuid) };
  const conversationUuid = bufferToUuid(conversation.uuid);
  publish([conversation.clientId, conversation.professionalId], { type: 'message', conversation: conversationUuid, message: dto, from: dto.senderUuid });
  await notifyOffline(conversation, senderRole, nameOf(sender), previewOf(text, !!imageUrl));
  return { message: dto };
}

export async function sendMessage(userId, uuid, input) {
  const { conversation } = await loadConversation(prisma, uuid, userId);
  const { message } = await deliver(conversation, userId, input);
  return { ...message, mine: true, read: false };
}

export async function markRead(userId, uuid) {
  const { conversation, role } = await loadConversation(prisma, uuid, userId);
  const receipts = await sharesReceipts(prisma, userId);
  const now = new Date();
  await prisma.conversation.update({ where: { id: conversation.id }, data: { [field(role, 'LastReadAt')]: now, ...(receipts && { [field(role, 'ReceiptAt')]: now }) } });
  if (receipts) publish([role === 'client' ? conversation.professionalId : conversation.clientId], { type: 'read', conversation: uuid, at: now });
  publish([userId], { type: 'unread' });
  return { ok: true };
}

export async function setArchived(userId, uuid, archived) {
  const { conversation, role } = await loadConversation(prisma, uuid, userId);
  await prisma.conversation.update({ where: { id: conversation.id }, data: { [field(role, 'ArchivedAt')]: archived ? new Date() : null } });
  publish([userId], { type: 'unread' });
  return { archived };
}

export async function reportUser(userId, uuid, { reason, details }) {
  if (!(reason in REPORT_REASONS)) fail(400, 'Escolha o motivo da denúncia.');
  const { conversation, other } = await loadConversation(prisma, uuid, userId);
  await prisma.userReport.create({ data: { reporterId: userId, reportedId: other.id, conversationId: conversation.id, reason, details: details?.trim().slice(0, 500) || null } });
  return { ok: true };
}

async function typingEvent(userId, uuid) {
  const { conversation, other } = await loadConversation(prisma, uuid, userId);
  if (await isBlockedBetween(prisma, conversation.clientId, conversation.professionalId)) return;
  typingUntil.set(`${conversation.id}:${userId}`, Date.now() + 5000);
  publish([other.id], { type: 'typing', conversation: uuid });
}
onTyping((userId, uuid) => typingEvent(userId, uuid).catch(() => {}));
export const sendTyping = (userId, uuid) => typingEvent(userId, uuid).then(() => ({ ok: true }));

// ---- Respostas rápidas e sugestões --------------------------------------------------------------------------------
async function templateVars(conversation) {
  const next = await prisma.order.findFirst({
    where: { listingId: conversation.listingId, clientId: conversation.clientId, status: { in: ['accepted', 'in_progress'] } }, orderBy: { scheduledDate: 'asc' }, select: { scheduledDate: true },
  });
  return {
    nome_do_cliente: nameOf(conversation.client).split(' ')[0], nome_do_profissional: nameOf(conversation.professional).split(' ')[0],
    servico: conversation.title, data: next ? brDate(next.scheduledDate) : 'a data combinada',
  };
}

const serializeReply = (reply) => ({
  id: reply.id.toString(), title: reply.title, body: reply.body, schedule: reply.schedule, offsetHours: reply.offsetHours,
  listingUuid: reply.listing ? bufferToUuid(reply.listing.uuid) : null, listingTitle: reply.listing?.title ?? null,
});

export async function conversationReplies(userId, uuid) {
  const { conversation } = await loadConversation(prisma, uuid, userId);
  const [vars, replies, settings, lastIncoming] = await Promise.all([
    templateVars(conversation),
    prisma.quickReply.findMany({ where: { userId, OR: [{ listingId: null }, { listingId: conversation.listingId ?? -1n }] }, orderBy: { title: 'asc' } }),
    prisma.userSettings.findUnique({ where: { userId }, select: { messageSuggestions: true } }),
    prisma.message.findFirst({ where: { conversationId: conversation.id, senderId: { not: userId }, kind: 'text' }, orderBy: { id: 'desc' }, select: { body: true } }),
  ]);
  const quickReplies = replies.map((reply) => ({ id: reply.id.toString(), title: reply.title, text: fillTemplate(reply.body, vars) }));
  const enabled = settings?.messageSuggestions ?? true;
  return { quickReplies, suggestionsEnabled: enabled, suggestions: enabled ? suggestReplies(lastIncoming?.body, quickReplies) : [] };
}

export async function listQuickReplies(userId) {
  const rows = await prisma.quickReply.findMany({ where: { userId }, include: { listing: { select: { uuid: true, title: true } } }, orderBy: { createdAt: 'desc' } });
  return rows.map(serializeReply);
}

async function replyData(userId, input) {
  let listingId = null;
  if (input.listing_uuid) {
    const listing = await prisma.listing.findFirst({ where: { uuid: uuidToBuffer(input.listing_uuid), ownerId: userId, deletedAt: null }, select: { id: true } });
    if (!listing) fail(400, 'Escolha um dos seus anúncios.');
    listingId = listing.id;
  }
  return { title: input.title, body: cleanMessageText(input.body), listingId, schedule: input.schedule ?? 'none', offsetHours: input.offset_hours ?? 24 };
}

export async function createQuickReply(userId, input) {
  if (await prisma.quickReply.count({ where: { userId } }) >= MESSAGE_LIMITS.repliesPerUser) fail(409, `Você pode ter até ${MESSAGE_LIMITS.repliesPerUser} respostas rápidas.`);
  const created = await prisma.quickReply.create({ data: { userId, ...await replyData(userId, input) }, include: { listing: { select: { uuid: true, title: true } } } });
  return serializeReply(created);
}

async function ownReply(userId, id) {
  if (!/^\d{1,18}$/.test(String(id))) fail(404, 'Resposta não encontrada.');
  const reply = await prisma.quickReply.findFirst({ where: { id: BigInt(id), userId } });
  if (!reply) fail(404, 'Resposta não encontrada.');
  return reply;
}

export async function updateQuickReply(userId, id, input) {
  const reply = await ownReply(userId, id);
  const updated = await prisma.quickReply.update({ where: { id: reply.id }, data: await replyData(userId, input), include: { listing: { select: { uuid: true, title: true } } } });
  return serializeReply(updated);
}

export async function deleteQuickReply(userId, id) {
  const reply = await ownReply(userId, id);
  await prisma.quickReply.delete({ where: { id: reply.id } });
  return { ok: true };
}

/**
 * Envia as respostas programadas que já venceram. Roda a cada minuto no servidor; cada pedido recebe
 * cada resposta uma única vez (ScheduledSend é único por resposta e pedido).
 */
export async function runScheduledSends(now = new Date()) {
  const replies = await prisma.quickReply.findMany({ where: { schedule: { not: 'none' } }, include: { listing: { select: { uuid: true } } } });
  let sent = 0;
  for (const reply of replies) {
    const statuses = reply.schedule === 'before_service' ? ['accepted', 'in_progress'] : ['completed'];
    const orders = await prisma.order.findMany({
      where: { professionalId: reply.userId, status: { in: statuses }, ...(reply.listingId && { listingId: reply.listingId }), scheduledSends: { none: { quickReplyId: reply.id } } },
      take: 50,
    });
    for (const order of orders) {
      if (!withinSendWindow(reply.schedule, order, now)) continue;
      const due = scheduledDueAt(reply.schedule, order, reply.offsetHours);
      if (!due || due > now) continue;
      try {
        await prisma.scheduledSend.create({ data: { quickReplyId: reply.id, orderId: order.id } }); // reserva: falha se já enviado
      } catch (err) { if (err.code === 'P2002') continue; throw err; }
      try {
        const { uuid } = await openConversation(reply.userId, { orderUuid: bufferToUuid(order.uuid) });
        const { conversation } = await loadConversation(prisma, uuid, reply.userId);
        const vars = await templateVars(conversation);
        let body = fillTemplate(reply.body, vars);
        if (reply.schedule === 'review_request') body += `\n\nAvalie o serviço: ${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/contratacoes/${bufferToUuid(order.uuid)}/avaliar`;
        await deliver(conversation, reply.userId, { body });
        sent += 1;
      } catch (err) { logger.error('messages.scheduled', err); }
    }
  }
  return sent;
}

let schedulerTimer = null;
export function startScheduler(intervalMs = 60 * 1000) {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => runScheduledSends().catch((err) => logger.error('messages.scheduler', err)), intervalMs);
  schedulerTimer.unref();
}

// ---- Preferências e feedback ----------------------------------------------------------------------------------------
export async function getMessagePrefs(userId) {
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { messageSuggestions: true } });
  return { suggestions: settings?.messageSuggestions ?? true };
}

export async function setMessagePrefs(userId, { suggestions }) {
  await prisma.userSettings.upsert({ where: { userId }, create: { userId, messageSuggestions: suggestions }, update: { messageSuggestions: suggestions } });
  return { suggestions };
}

export async function saveFeedback(userId, { kind, message, page }) {
  await prisma.feedback.create({ data: { userId, kind, message: cleanMessageText(message), page: page?.slice(0, 200) || null } });
  return { ok: true };
}
