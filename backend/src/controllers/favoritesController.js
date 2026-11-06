import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { isBlockedBetween } from '../utils/blocks.js';
import { listingCard, listingCardInclude } from './listingController.js';

const DEFAULT_LIST = 'Favoritos';
const MAX_LISTS = 30;
const MAX_RECENT = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ['professional', 'listing'];
const me = (req) => BigInt(req.user.id);

const professionalSelect = {
  displayName: true, headline: true, publicPhotoUrl: true, averageRating: true, totalReviews: true,
  user: { select: { uuid: true, firstName: true, lastName: true, profilePictureUrl: true, city: true, state: true } },
};

function professionalCard(profile) {
  const { user } = profile;
  return {
    type: 'professional', uuid: bufferToUuid(user.uuid), name: profile.displayName || [user.firstName, user.lastName].filter(Boolean).join(' '),
    headline: profile.headline, photo: profile.publicPhotoUrl || user.profilePictureUrl, rating: Number(profile.averageRating), reviews: profile.totalReviews,
    location: [user.city, user.state].filter(Boolean).join(', ') || null,
  };
}

function listingFavoriteCard(listing) {
  if (!listing || listing.status !== 'published' || listing.deletedAt) return null;
  const card = listingCard(listing);
  return {
    type: 'listing', uuid: card.uuid, name: card.title, headline: card.owner.name, photo: card.cover, rating: card.owner.rating, reviews: card.owner.reviews,
    location: [card.city, card.state].filter(Boolean).join(', ') || null, pricingModel: card.pricingModel, price: card.price,
  };
}

// Tipos de item que podem ser favoritados: como achar o alvo e qual coluna usa.
export const favoriteTargets = {
  async professional(userId, uuid) {
    const user = await prisma.user.findFirst({ where: { uuid: uuidToBuffer(uuid), deletedAt: null, deactivatedAt: null, professionalProfile: { isNot: null } }, select: { id: true } });
    if (!user || await isBlockedBetween(prisma, userId, user.id)) return null;
    return { column: 'professionalId', id: user.id };
  },
  async listing(userId, uuid) {
    const listing = await prisma.listing.findFirst({ where: { uuid: uuidToBuffer(uuid), status: 'published', deletedAt: null, owner: { deletedAt: null, deactivatedAt: null } }, select: { id: true, ownerId: true } });
    if (!listing || await isBlockedBetween(prisma, userId, listing.ownerId)) return null;
    return { column: 'listingId', id: listing.id };
  },
};

async function target(req, type, uuid) {
  const resolver = favoriteTargets[type];
  return resolver ? resolver(me(req), uuid) : null;
}

function handle(res, err, label) {
  if (err.code === 'P2002') return res.status(409).json({ message: 'Você já tem uma lista com esse nome.' });
  if (err.status) return res.status(err.status).json({ message: err.message });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}

const listId = (req) => (/^\d{1,19}$/.test(req.params.id) ? BigInt(req.params.id) : null);

async function ownedList(req) {
  const id = listId(req);
  return id ? prisma.favoriteList.findFirst({ where: { id, userId: me(req) } }) : null;
}

const itemInclude = { professional: { select: professionalSelect }, listing: { include: listingCardInclude } };
const cardOf = (item) => (item.listing ? listingFavoriteCard(item.listing) : item.professional ? professionalCard(item.professional) : null);

export async function overview(req, res) {
  try {
    const userId = me(req);
    const [lists, recentProfessionals, recentListings] = await Promise.all([
      prisma.favoriteList.findMany({
        where: { userId }, orderBy: { createdAt: 'asc' },
        include: { _count: { select: { items: true } }, items: { take: 1, orderBy: { createdAt: 'desc' }, include: itemInclude } },
      }),
      prisma.recentView.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, take: 12, include: { professional: { select: professionalSelect } } }),
      prisma.recentListingView.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, take: 12, include: { listing: { include: listingCardInclude } } }),
    ]);
    const recent = [
      ...recentProfessionals.map((row) => ({ at: row.viewedAt, card: professionalCard(row.professional) })),
      ...recentListings.map((row) => ({ at: row.viewedAt, card: listingFavoriteCard(row.listing) })),
    ].filter((row) => row.card).sort((a, b) => b.at - a.at).slice(0, 12).map((row) => row.card);
    res.set('Cache-Control', 'no-store').json({
      lists: lists.map((list) => ({ id: list.id.toString(), name: list.name, count: list._count.items, cover: list.items[0] ? cardOf(list.items[0])?.photo ?? null : null })),
      recent,
    });
  } catch (err) { handle(res, err, 'favorites.overview'); }
}

export async function showList(req, res) {
  try {
    const list = await ownedList(req);
    if (!list) return res.status(404).json({ message: 'Lista não encontrada.' });
    const items = await prisma.favoriteItem.findMany({ where: { listId: list.id }, orderBy: { createdAt: 'desc' }, include: itemInclude });
    res.set('Cache-Control', 'no-store').json({ id: list.id.toString(), name: list.name, items: items.map(cardOf).filter(Boolean) });
  } catch (err) { handle(res, err, 'favorites.showList'); }
}

export async function createList(req, res) {
  try {
    const userId = me(req);
    if (await prisma.favoriteList.count({ where: { userId } }) >= MAX_LISTS) return res.status(409).json({ message: `Você pode ter até ${MAX_LISTS} listas.` });
    const list = await prisma.favoriteList.create({ data: { userId, name: req.body.name } });
    res.status(201).json({ id: list.id.toString(), name: list.name, count: 0, cover: null });
  } catch (err) { handle(res, err, 'favorites.createList'); }
}

export async function renameList(req, res) {
  try {
    const list = await ownedList(req);
    if (!list) return res.status(404).json({ message: 'Lista não encontrada.' });
    await prisma.favoriteList.update({ where: { id: list.id }, data: { name: req.body.name } });
    res.json({ id: list.id.toString(), name: req.body.name });
  } catch (err) { handle(res, err, 'favorites.renameList'); }
}

export async function deleteList(req, res) {
  try {
    const list = await ownedList(req);
    if (!list) return res.status(404).json({ message: 'Lista não encontrada.' });
    await prisma.favoriteList.delete({ where: { id: list.id } });
    res.sendStatus(204);
  } catch (err) { handle(res, err, 'favorites.deleteList'); }
}

/** Quais itens da página já estão salvos (para pintar os corações dos cartões de uma vez). */
export async function status(req, res) {
  try {
    const uuids = String(req.query.uuids ?? '').split(',').filter((value) => UUID.test(value)).slice(0, 60);
    const type = req.query.type;
    if (!TYPES.includes(type) || !uuids.length) return res.json({ saved: {} });
    const buffers = uuids.map(uuidToBuffer);
    const rows = type === 'listing'
      ? (await prisma.favoriteItem.findMany({ where: { list: { userId: me(req) }, listing: { uuid: { in: buffers } } }, select: { listing: { select: { uuid: true } } } })).map((row) => row.listing.uuid)
      : (await prisma.favoriteItem.findMany({ where: { list: { userId: me(req) }, professional: { user: { uuid: { in: buffers } } } }, select: { professional: { select: { user: { select: { uuid: true } } } } } })).map((row) => row.professional.user.uuid);
    res.set('Cache-Control', 'no-store').json({ saved: Object.fromEntries(rows.map((uuid) => [bufferToUuid(uuid), true])) });
  } catch (err) { handle(res, err, 'favorites.status'); }
}

/** Listas do usuário com a marca de quais já contêm o item (alimenta a janela "Salvar em lista"). */
export async function itemLists(req, res) {
  try {
    const userId = me(req);
    const found = UUID.test(String(req.query.uuid)) ? await target(req, req.query.type, req.query.uuid) : null;
    if (!found) return res.status(404).json({ message: 'Item não encontrado.' });
    if (!await prisma.favoriteList.count({ where: { userId } })) await prisma.favoriteList.create({ data: { userId, name: DEFAULT_LIST } });
    const lists = await prisma.favoriteList.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { items: { where: { [found.column]: found.id }, select: { id: true } } } });
    res.set('Cache-Control', 'no-store').json({ lists: lists.map((list) => ({ id: list.id.toString(), name: list.name, saved: list.items.length > 0 })) });
  } catch (err) { handle(res, err, 'favorites.itemLists'); }
}

export async function saveItem(req, res) {
  try {
    const userId = me(req);
    const found = await target(req, req.body.type, req.body.uuid);
    if (!found) return res.status(404).json({ message: 'Item não encontrado.' });
    const wanted = [...new Set(req.body.list_ids.map((id) => BigInt(id)))];
    const owned = await prisma.favoriteList.findMany({ where: { userId, id: { in: wanted } }, select: { id: true } });
    if (owned.length !== wanted.length) return res.status(400).json({ message: 'Uma das listas escolhidas não existe.' });
    await prisma.$transaction([
      prisma.favoriteItem.deleteMany({ where: { [found.column]: found.id, list: { userId }, listId: { notIn: wanted } } }),
      prisma.favoriteItem.createMany({ data: wanted.map((id) => ({ listId: id, [found.column]: found.id })), skipDuplicates: true }),
    ]);
    res.json({ saved: wanted.length > 0 });
  } catch (err) { handle(res, err, 'favorites.saveItem'); }
}

export async function recordView(req, res) {
  try {
    const userId = me(req);
    const type = req.body?.type;
    const found = UUID.test(String(req.body?.uuid)) ? await target(req, type, req.body.uuid) : null;
    if (!found) return res.sendStatus(204);
    if (type === 'professional') {
      if (found.id === userId) return res.sendStatus(204);
      await prisma.recentView.upsert({ where: { userId_professionalId: { userId, professionalId: found.id } }, create: { userId, professionalId: found.id }, update: { viewedAt: new Date() } });
      const stale = await prisma.recentView.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, skip: MAX_RECENT, select: { professionalId: true } });
      if (stale.length) await prisma.recentView.deleteMany({ where: { userId, professionalId: { in: stale.map((row) => row.professionalId) } } });
    } else {
      const own = await prisma.listing.count({ where: { id: found.id, ownerId: userId } });
      if (own) return res.sendStatus(204);
      await prisma.recentListingView.upsert({ where: { userId_listingId: { userId, listingId: found.id } }, create: { userId, listingId: found.id }, update: { viewedAt: new Date() } });
      const stale = await prisma.recentListingView.findMany({ where: { userId }, orderBy: { viewedAt: 'desc' }, skip: MAX_RECENT, select: { listingId: true } });
      if (stale.length) await prisma.recentListingView.deleteMany({ where: { userId, listingId: { in: stale.map((row) => row.listingId) } } });
    }
    res.sendStatus(204);
  } catch (err) { handle(res, err, 'favorites.recordView'); }
}
