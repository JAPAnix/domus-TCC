import { logger } from '../utils/logger.js';
import {
  conversationReplies, createQuickReply, deleteQuickReply, getConversation, getMessagePrefs, listConversations, listQuickReplies, markRead,
  openConversation, reportUser, saveFeedback, sendMessage, sendTyping, setArchived, setMessagePrefs, unreadTotal, updateQuickReply,
} from '../services/messageService.js';

const me = (req) => BigInt(req.user.id);

function fail(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}
const handler = (label, work, status = 200) => async (req, res) => {
  try { const result = await work(req); res.status(status).set('Cache-Control', 'no-store').json(result); } catch (err) { fail(res, err, label); }
};

/** A foto precisa ter sido enviada pelo próprio usuário para mensagens (nada de links de terceiros). */
export function trustedMessageImage(url, req) {
  try {
    const parsed = new URL(url);
    const hosts = [req.get('host'), process.env.PUBLIC_BASE_URL && new URL(process.env.PUBLIC_BASE_URL).host, 'res.cloudinary.com'].filter(Boolean);
    return hosts.includes(parsed.host) && new RegExp(`/${req.user.uuid}/message/[0-9a-f-]{36}\\.(jpg|png|webp|gif)$`, 'i').test(parsed.pathname);
  } catch { return false; }
}

export const open = handler('messages.open', (req) => openConversation(me(req), { listingUuid: req.body.listing_uuid, orderUuid: req.body.order_uuid, serviceUuid: req.body.service_uuid, professionalUuid: req.body.professional_uuid }), 201);
export const list = handler('messages.list', (req) => listConversations(me(req), {
  archived: req.query.arquivadas === '1', q: String(req.query.q ?? ''), page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(50, Math.max(1, Number(req.query.limit) || 30)),
}));
export const unread = handler('messages.unread', async (req) => ({ count: await unreadTotal(me(req)) }));
export const show = handler('messages.show', (req) => getConversation(me(req), req.params.uuid, { before: req.query.antes, limit: Math.min(100, Math.max(1, Number(req.query.limit) || 40)) }));
export const read = handler('messages.read', (req) => markRead(me(req), req.params.uuid));
export const archive = handler('messages.archive', (req) => setArchived(me(req), req.params.uuid, true));
export const unarchive = handler('messages.unarchive', (req) => setArchived(me(req), req.params.uuid, false));
export const typing = handler('messages.typing', (req) => sendTyping(me(req), req.params.uuid));
export const report = handler('messages.report', (req) => reportUser(me(req), req.params.uuid, req.body), 201);
export const replies = handler('messages.replies', (req) => conversationReplies(me(req), req.params.uuid));

export async function send(req, res) {
  try {
    if (req.body.image_url && !trustedMessageImage(req.body.image_url, req)) return res.status(400).json({ message: 'Envie a foto pelo próprio Dommos.' });
    res.status(201).json(await sendMessage(me(req), req.params.uuid, { body: req.body.body, imageUrl: req.body.image_url ?? null }));
  } catch (err) { fail(res, err, 'messages.send'); }
}

export const quickList = handler('quickReplies.list', (req) => listQuickReplies(me(req)));
export const quickCreate = handler('quickReplies.create', (req) => createQuickReply(me(req), req.body), 201);
export const quickUpdate = handler('quickReplies.update', (req) => updateQuickReply(me(req), req.params.id, req.body));
export const quickDelete = handler('quickReplies.delete', (req) => deleteQuickReply(me(req), req.params.id));
export const prefsGet = handler('messages.prefs', (req) => getMessagePrefs(me(req)));
export const prefsPut = handler('messages.prefsPut', (req) => setMessagePrefs(me(req), req.body));
export const feedback = handler('feedback.create', (req) => saveFeedback(me(req), req.body), 201);
