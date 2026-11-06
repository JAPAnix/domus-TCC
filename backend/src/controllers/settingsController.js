import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { NOTIFICATION_CATALOG, resolvePreferences, applyPreferencePatch } from '../utils/notificationPrefs.js';
import { SUPPORTED_LANGUAGES, SUPPORTED_CURRENCIES } from '../utils/locales.js';
import { maskDocument, maskPayoutKey, onlyDigits } from '../utils/taxDocument.js';
import { normalizePayoutKey } from '../validators/areaValidator.js';

const me = (req) => BigInt(req.user.id);

function handle(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err.message?.startsWith('Telefone inválido')) return res.status(400).json({ message: err.message });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível salvar. Tente novamente.' });
}

export function ensureSettings(userId) {
  return prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
}

function present(settings, hasProfessionalProfile) {
  const cookies = settings.cookiePreferences ?? {};
  return {
    privacy: {
      profileVisibility: settings.profileVisibility, readReceipts: settings.readReceipts,
      searchIndexing: settings.searchIndexing, showWrittenReviews: settings.showWrittenReviews,
    },
    notifications: { catalog: NOTIFICATION_CATALOG, values: resolvePreferences(settings.notificationPreferences) },
    cookies: { analytics: cookies.analytics === true, marketing: cookies.marketing === true },
    locale: { language: settings.language, currency: settings.currency, supported: { languages: SUPPORTED_LANGUAGES, currencies: SUPPORTED_CURRENCIES } },
    tax: {
      documentType: settings.taxDocumentType, documentMasked: maskDocument(settings.taxDocumentType, settings.taxDocument),
      holderName: settings.taxHolderName, payoutKeyType: settings.payoutKeyType, payoutKeyMasked: maskPayoutKey(settings.payoutKeyType, settings.payoutKey),
    },
    hasProfessionalProfile,
  };
}

async function respond(req, res) {
  const userId = me(req);
  const [settings, profile] = await Promise.all([ensureSettings(userId), prisma.professionalProfile.findUnique({ where: { userId }, select: { userId: true } })]);
  res.set('Cache-Control', 'no-store').json(present(settings, !!profile));
}

export async function getSettings(req, res) {
  try { await respond(req, res); } catch (err) { handle(res, err, 'getSettings'); }
}

export async function updatePrivacy(req, res) {
  try {
    const { profile_visibility, read_receipts, search_indexing, show_written_reviews } = req.body;
    await prisma.userSettings.upsert({
      where: { userId: me(req) },
      create: { userId: me(req), ...(profile_visibility && { profileVisibility: profile_visibility }), ...(read_receipts !== undefined && { readReceipts: read_receipts }), ...(search_indexing !== undefined && { searchIndexing: search_indexing }), ...(show_written_reviews !== undefined && { showWrittenReviews: show_written_reviews }) },
      update: { ...(profile_visibility && { profileVisibility: profile_visibility }), ...(read_receipts !== undefined && { readReceipts: read_receipts }), ...(search_indexing !== undefined && { searchIndexing: search_indexing }), ...(show_written_reviews !== undefined && { showWrittenReviews: show_written_reviews }) },
    });
    await respond(req, res);
  } catch (err) { handle(res, err, 'updatePrivacy'); }
}

export async function updateNotifications(req, res) {
  try {
    const settings = await ensureSettings(me(req));
    const next = applyPreferencePatch(settings.notificationPreferences, req.body);
    await prisma.userSettings.update({ where: { userId: me(req) }, data: { notificationPreferences: next } });
    await respond(req, res);
  } catch (err) { handle(res, err, 'updateNotifications'); }
}

export async function updateCookies(req, res) {
  try {
    const settings = await ensureSettings(me(req));
    const current = settings.cookiePreferences ?? {};
    await prisma.userSettings.update({ where: { userId: me(req) }, data: { cookiePreferences: { analytics: current.analytics === true, marketing: current.marketing === true, ...req.body } } });
    await respond(req, res);
  } catch (err) { handle(res, err, 'updateCookies'); }
}

export async function updateLocale(req, res) {
  try {
    await prisma.userSettings.upsert({ where: { userId: me(req) }, create: { userId: me(req), language: req.body.language, currency: req.body.currency }, update: { language: req.body.language, currency: req.body.currency } });
    await respond(req, res);
  } catch (err) { handle(res, err, 'updateLocale'); }
}

export async function updateTax(req, res) {
  try {
    // A chave Pix é gerenciada em Pagamentos > Como recebo e não é alterada aqui.
    const { document_type, document, holder_name } = req.body;
    const data = { taxDocumentType: document_type, taxDocument: onlyDigits(document), taxHolderName: holder_name };
    await prisma.userSettings.upsert({ where: { userId: me(req) }, create: { userId: me(req), ...data }, update: data });
    await respond(req, res);
  } catch (err) { handle(res, err, 'updateTax'); }
}

export async function clearTax(req, res) {
  try {
    await prisma.userSettings.updateMany({ where: { userId: me(req) }, data: { taxDocumentType: null, taxDocument: null, taxHolderName: null } });
    await respond(req, res);
  } catch (err) { handle(res, err, 'clearTax'); }
}

