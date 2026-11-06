import { prisma } from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { normalizeCity, normalizeOptionalText, normalizeState } from '../utils/userData.js';
import { blockedIds, publiclyListedUser } from '../utils/blocks.js';
import { validateStep, validateAll, LISTING_LIMITS } from '../utils/listingRules.js';
import { bookingDateError, dateKey, earliestDate } from '../utils/orderRules.js';
import { registerDeletionStep } from './accountController.js';
import { platformFeePercent } from '../services/orderWorkflow.js';
import { busyForListing, listingReviews, ownerPageData, reportListing, REPORT_REASONS } from '../services/listingPageService.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LISTINGS = 50;
const ACTIVE_ORDER_STATUSES = ['requested', 'accepted', 'in_progress'];
const me = (req) => BigInt(req.user.id);
const list = (value) => (Array.isArray(value) ? value : []);
const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
const num = (value) => (value == null ? null : Number(value));

export const listingInclude = {
  images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
  category: { select: { id: true, name: true } },
  catalogItem: { select: { id: true, name: true } },
};
const ownerSelect = {
  uuid: true, firstName: true, lastName: true, preferredName: true, profilePictureUrl: true, city: true, state: true, createdAt: true,
  professionalProfile: { select: { averageRating: true, totalReviews: true, isVerified: true } },
};

const modesOf = (listing) => [listing.atClientPlace && 'client_place', listing.atProPlace && 'pro_place', listing.isRemote && 'remote'].filter(Boolean);

function serialize(listing) {
  const availability = listing.availability && typeof listing.availability === 'object' ? listing.availability : null;
  return {
    uuid: bufferToUuid(listing.uuid), status: listing.status, wizardStep: listing.wizardStep,
    categoryId: listing.categoryId, category: listing.category ?? null, catalogItemId: listing.catalogItemId, catalogItem: listing.catalogItem ?? null,
    serviceModes: modesOf(listing), city: listing.city, state: listing.state, radiusKm: listing.radiusKm,
    title: listing.title, description: listing.description, included: list(listing.included), excluded: list(listing.excluded),
    requirements: listing.requirements, materials: listing.materials, pricingModel: listing.pricingModel, price: num(listing.price), travelFee: num(listing.travelFee),
    packages: list(listing.packages), availability: availability ? { weekdays: list(availability.weekdays), leadTimeHours: availability.leadTimeHours ?? 24 } : null,
    cancellationPolicy: listing.cancellationPolicy, images: (listing.images ?? []).map((image) => image.url),
    publishedAt: listing.publishedAt, createdAt: listing.createdAt, updatedAt: listing.updatedAt,
  };
}

/** Os dados do anúncio no formato das regras compartilhadas (listingRules). */
async function rulesData(listing, userId) {
  const data = serialize(listing);
  const [verification, settings] = await Promise.all([
    prisma.professionalVerification.findUnique({ where: { userId } }),
    prisma.userSettings.findUnique({ where: { userId }, select: { taxDocument: true, taxDocumentType: true } }),
  ]);
  return { ...data, verification: { legalName: verification?.legalName ?? '', documentOk: !!(verification && settings?.taxDocument && settings.taxDocumentType === verification.documentType) } };
}

/** Converte o corpo da requisição (snake_case) nos campos das regras (camelCase). Só inclui o que foi enviado. */
function bodyToOverlay(body) {
  const o = {};
  const has = (key) => Object.hasOwn(body, key);
  if (has('category_id')) o.categoryId = body.category_id;
  if (has('catalog_item_id')) o.catalogItemId = body.catalog_item_id;
  if (has('service_modes')) o.serviceModes = [...new Set(body.service_modes)];
  if (has('city')) o.city = normalizeCity(body.city ?? '');
  if (has('state')) o.state = normalizeState(body.state ?? '');
  if (has('radius_km')) o.radiusKm = body.radius_km;
  if (has('title')) o.title = normalizeOptionalText(body.title ?? '');
  if (has('description')) o.description = normalizeOptionalText(body.description ?? '');
  if (has('image_urls')) o.images = body.image_urls;
  if (has('included')) o.included = body.included;
  if (has('excluded')) o.excluded = body.excluded;
  if (has('requirements')) o.requirements = normalizeOptionalText(body.requirements ?? '');
  if (has('materials')) o.materials = normalizeOptionalText(body.materials ?? '');
  if (has('pricing_model')) o.pricingModel = body.pricing_model;
  if (has('price')) o.price = body.price;
  if (has('travel_fee')) o.travelFee = body.travel_fee;
  if (has('packages')) o.packages = body.packages;
  if (has('availability')) o.availability = body.availability ? { weekdays: body.availability.weekdays, leadTimeHours: body.availability.lead_time_hours } : null;
  if (has('cancellation_policy')) o.cancellationPolicy = body.cancellation_policy;
  return o;
}

const jsonOrNull = (value) => (Array.isArray(value) && value.length ? value : Prisma.DbNull);

/** Aplica as regras de limpeza (ex.: "sob consulta" não tem preço) e devolve os campos do banco. */
function overlayToDb(overlay, merged) {
  const db = {};
  const set = (key, column, transform = (value) => value) => { if (Object.hasOwn(overlay, key)) db[column] = transform(overlay[key]); };
  set('categoryId', 'categoryId'); set('catalogItemId', 'catalogItemId'); set('city', 'city'); set('state', 'state'); set('radiusKm', 'radiusKm');
  set('title', 'title'); set('description', 'description'); set('requirements', 'requirements'); set('materials', 'materials');
  set('pricingModel', 'pricingModel'); set('price', 'price'); set('travelFee', 'travelFee'); set('cancellationPolicy', 'cancellationPolicy');
  set('included', 'included', jsonOrNull); set('excluded', 'excluded', jsonOrNull); set('packages', 'packages', jsonOrNull);
  set('availability', 'availability', (value) => value ?? Prisma.DbNull);
  if (Object.hasOwn(overlay, 'serviceModes')) {
    db.atClientPlace = overlay.serviceModes.includes('client_place');
    db.atProPlace = overlay.serviceModes.includes('pro_place');
    db.isRemote = overlay.serviceModes.includes('remote');
  }
  // Campos que deixam de fazer sentido dependendo do que foi escolhido.
  if (merged.pricingModel === 'quote') { db.price = null; db.packages = Prisma.DbNull; }
  if (!list(merged.serviceModes).includes('client_place')) { db.travelFee = null; db.radiusKm = null; }
  return db;
}

function handle(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message, ...(err.errors && { errors: err.errors }) });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}

const stepError = (errors) => Object.assign(new Error('Confira os campos destacados.'), { status: 422, errors: Object.entries(errors).map(([field, message]) => ({ field, message })) });

async function loadOwned(req) {
  if (!UUID.test(req.params.uuid)) return null;
  return prisma.listing.findFirst({ where: { uuid: uuidToBuffer(req.params.uuid), ownerId: me(req), deletedAt: null }, include: listingInclude });
}

async function checkCatalog(categoryId, catalogItemId) {
  if (!categoryId || !catalogItemId) return;
  const item = await prisma.serviceCatalogItem.findFirst({ where: { id: catalogItemId, categoryId, active: true }, select: { id: true } });
  if (!item) throw stepError({ catalogItemId: 'Esse tipo de serviço não pertence à categoria escolhida.' });
}

// ---------------------------------------------------------------- área do profissional
export async function myListings(req, res) {
  try {
    const rows = await prisma.listing.findMany({
      where: { ownerId: me(req), deletedAt: null }, orderBy: { updatedAt: 'desc' },
      include: { ...listingInclude, images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } }, _count: { select: { orders: { where: { status: { in: ACTIVE_ORDER_STATUSES } } } } } },
    });
    res.set('Cache-Control', 'no-store').json(rows.map((row) => ({ ...serialize(row), activeOrders: row._count.orders })));
  } catch (err) { handle(res, err, 'myListings'); }
}

export async function createDraft(req, res) {
  try {
    const userId = me(req);
    if (await prisma.listing.count({ where: { ownerId: userId, deletedAt: null } }) >= MAX_LISTINGS) return res.status(409).json({ message: `Você pode ter até ${MAX_LISTINGS} anúncios.` });
    const listing = await prisma.listing.create({ data: { uuid: generateUuid(), ownerId: userId }, include: listingInclude });
    res.status(201).json(serialize(listing));
  } catch (err) { handle(res, err, 'createDraft'); }
}

export async function getOwnListing(req, res) {
  try {
    const listing = await loadOwned(req);
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    const data = await rulesData(listing, me(req));
    res.set('Cache-Control', 'no-store').json({ ...serialize(listing), verificationOk: data.verification.documentOk, legalName: data.verification.legalName });
  } catch (err) { handle(res, err, 'getOwnListing'); }
}

export async function updateListing(req, res) {
  try {
    const listing = await loadOwned(req);
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    const overlay = bodyToOverlay(req.body);
    const merged = { ...(await rulesData(listing, me(req))), ...overlay };
    if (req.body.validate_step) {
      const errors = validateStep(req.body.validate_step, merged);
      if (Object.keys(errors).length) throw stepError(errors);
    }
    await checkCatalog(merged.categoryId, merged.catalogItemId);
    const db = overlayToDb(overlay, merged);
    if (req.body.wizard_step) db.wizardStep = req.body.wizard_step;
    const images = Object.hasOwn(overlay, 'images') ? { images: { deleteMany: {}, create: overlay.images.map((url, sortOrder) => ({ url, sortOrder })) } } : {};
    const updated = await prisma.listing.update({ where: { id: listing.id }, data: { ...db, ...images }, include: listingInclude });
    res.json(serialize(updated));
  } catch (err) { handle(res, err, 'updateListing'); }
}

async function publish(req, res, listing) {
  const userId = me(req);
  const data = await rulesData(listing, userId);
  const problems = validateAll(data);
  if (problems.length) {
    return res.status(422).json({ message: 'Falta completar algumas etapas antes de publicar.', errors: problems, firstStep: Math.min(...problems.map((problem) => problem.step)) });
  }
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { firstName: true, lastName: true, preferredName: true } });
    if (!user) throw Object.assign(new Error('Conta indisponível. Entre novamente.'), { status: 401 });
    const profile = await tx.professionalProfile.findUnique({ where: { userId }, select: { userId: true } });
    if (profile) await tx.professionalProfile.update({ where: { userId }, data: { isPublished: true } });
    else await tx.professionalProfile.create({ data: { userId, displayName: nameOf(user), billingMode: 'quote', hourlyRate: 0, isPublished: true } });
    const role = await tx.role.upsert({ where: { name: 'professional' }, update: {}, create: { name: 'professional' } });
    await tx.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, update: {}, create: { userId, roleId: role.id } });
    await tx.listing.update({ where: { id: listing.id }, data: { status: 'published', wizardStep: 10, publishedAt: listing.publishedAt ?? new Date() } });
  });
  const fresh = await prisma.listing.findUnique({ where: { id: listing.id }, include: listingInclude });
  res.json(serialize(fresh));
}

export async function publishListing(req, res) {
  try {
    const listing = await loadOwned(req);
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    await publish(req, res, listing);
  } catch (err) { handle(res, err, 'publishListing'); }
}

export async function pauseListing(req, res) {
  try {
    const listing = await loadOwned(req);
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    if (listing.status !== 'published') return res.status(409).json({ message: 'Só é possível pausar um anúncio publicado.' });
    const updated = await prisma.listing.update({ where: { id: listing.id }, data: { status: 'paused' }, include: listingInclude });
    res.json(serialize(updated));
  } catch (err) { handle(res, err, 'pauseListing'); }
}

export async function duplicateListing(req, res) {
  try {
    const userId = me(req);
    const listing = await loadOwned(req);
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    if (await prisma.listing.count({ where: { ownerId: userId, deletedAt: null } }) >= MAX_LISTINGS) return res.status(409).json({ message: `Você pode ter até ${MAX_LISTINGS} anúncios.` });
    const copy = await prisma.listing.create({
      data: {
        uuid: generateUuid(), ownerId: userId, status: 'draft', wizardStep: 10, categoryId: listing.categoryId, catalogItemId: listing.catalogItemId,
        atClientPlace: listing.atClientPlace, atProPlace: listing.atProPlace, isRemote: listing.isRemote, city: listing.city, state: listing.state, radiusKm: listing.radiusKm,
        title: listing.title ? `${listing.title} (cópia)`.slice(0, 120) : null, description: listing.description,
        included: jsonOrNull(list(listing.included)), excluded: jsonOrNull(list(listing.excluded)), requirements: listing.requirements, materials: listing.materials,
        pricingModel: listing.pricingModel, price: listing.price, travelFee: listing.travelFee, packages: jsonOrNull(list(listing.packages)),
        availability: listing.availability ?? Prisma.DbNull, cancellationPolicy: listing.cancellationPolicy,
        images: { create: listing.images.map((image, sortOrder) => ({ url: image.url, sortOrder })) },
      },
      include: listingInclude,
    });
    res.status(201).json(serialize(copy));
  } catch (err) { handle(res, err, 'duplicateListing'); }
}

export async function deleteListing(req, res) {
  try {
    const listing = await loadOwned(req);
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    const active = await prisma.order.count({ where: { listingId: listing.id, status: { in: ACTIVE_ORDER_STATUSES } } });
    if (active) return res.status(409).json({ message: 'Este anúncio tem pedidos em aberto ou em andamento. Conclua ou cancele esses pedidos antes de excluir.' });
    await prisma.listing.update({ where: { id: listing.id }, data: { deletedAt: new Date(), status: 'paused' } });
    res.sendStatus(204);
  } catch (err) { handle(res, err, 'deleteListing'); }
}

// ---------------------------------------------------------------- público
export function listingConfig(req, res) {
  res.json({ platformFeePercent: platformFeePercent(), limits: LISTING_LIMITS });
}

function card(row) {
  const profile = row.owner.professionalProfile;
  return {
    uuid: bufferToUuid(row.uuid), title: row.title, cover: row.images[0]?.url ?? null, city: row.city, state: row.state, serviceModes: modesOf(row),
    pricingModel: row.pricingModel, price: num(row.price), travelFee: num(row.travelFee), category: row.category?.name ?? null,
    owner: { uuid: bufferToUuid(row.owner.uuid), name: nameOf(row.owner), profilePictureUrl: row.owner.profilePictureUrl, rating: num(profile?.averageRating) ?? 0, reviews: profile?.totalReviews ?? 0, verified: !!profile?.isVerified },
  };
}

const cardInclude = { images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } }, category: { select: { name: true } }, owner: { select: ownerSelect } };
export { card as listingCard, cardInclude as listingCardInclude };

const SORTS = {
  relevance: [{ owner: { professionalProfile: { averageRating: 'desc' } } }, { owner: { professionalProfile: { totalReviews: 'desc' } } }, { publishedAt: 'desc' }],
  rating: [{ owner: { professionalProfile: { averageRating: 'desc' } } }, { publishedAt: 'desc' }],
  price_asc: [{ price: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'desc' }],
  price_desc: [{ price: { sort: 'desc', nulls: 'last' } }, { publishedAt: 'desc' }],
  newest: [{ publishedAt: 'desc' }],
};
const MODE_COLUMNS = { client_place: 'atClientPlace', pro_place: 'atProPlace', remote: 'isRemote' };
const DATE_SCAN_LIMIT = 300;

export async function searchListings(req, res) {
  try {
    const q = req.query;
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(24, Math.max(1, Number(q.limit) || 12));
    for (const key of ['categoryId', 'serviceId']) if (q[key] && !Number.isInteger(Number(q[key]))) return res.status(400).json({ message: 'Filtro inválido.' });
    if (q.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(q.date))) return res.status(400).json({ message: 'Data inválida.' });

    const and = [];
    if (q.city) and.push({ OR: [{ city: String(q.city).trim() }, { isRemote: true }] });
    if (q.q) and.push({ OR: [{ title: { contains: String(q.q).trim() } }, { description: { contains: String(q.q).trim() } }] });
    const viewer = req.user ? BigInt(req.user.id) : null;
    const excluded = viewer ? await blockedIds(prisma, viewer) : [];
    const minRating = Number(q.minRating);
    const where = {
      status: 'published', deletedAt: null,
      owner: { ...publiclyListedUser, ...(minRating > 0 && { professionalProfile: { is: { averageRating: { gte: minRating } } } }), ...(UUID.test(String(q.ownerUuid ?? '')) && { uuid: uuidToBuffer(q.ownerUuid) }) },
      ...(excluded.length && { ownerId: { notIn: excluded } }),
      ...(UUID.test(String(q.exclude ?? '')) && { NOT: { uuid: uuidToBuffer(q.exclude) } }),
      ...(q.categoryId && { categoryId: Number(q.categoryId) }),
      ...(q.serviceId && { catalogItemId: Number(q.serviceId) }),
      ...(MODE_COLUMNS[q.mode] && { [MODE_COLUMNS[q.mode]]: true }),
      ...((q.minPrice || q.maxPrice) && { price: { ...(Number(q.minPrice) > 0 && { gte: Number(q.minPrice) }), ...(Number(q.maxPrice) > 0 && { lte: Number(q.maxPrice) }) } }),
      ...(and.length && { AND: and }),
    };
    const orderBy = SORTS[q.sort] ?? SORTS.relevance;

    // A data depende do dia da semana e de datas bloqueadas; por isso é conferida aqui, e não no banco.
    if (q.date) {
      const rows = await prisma.listing.findMany({ where, orderBy, take: DATE_SCAN_LIMIT, include: cardInclude });
      const blocked = await prisma.professionalAvailability.findMany({ where: { date: new Date(`${q.date}T00:00:00.000Z`), isAvailable: false, professionalId: { in: [...new Set(rows.map((row) => row.ownerId))] } }, select: { professionalId: true } });
      const blockedOwners = new Set(blocked.map((row) => row.professionalId.toString()));
      const now = new Date();
      const matching = rows.filter((row) => !bookingDateError(row.availability, q.date, now, new Set(blockedOwners.has(row.ownerId.toString()) ? [q.date] : [])));
      return res.json({ data: matching.slice((page - 1) * limit, page * limit).map(card), meta: { total: matching.length, page, limit, pages: Math.ceil(matching.length / limit) } });
    }

    const [rows, total] = await prisma.$transaction([
      prisma.listing.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include: cardInclude }),
      prisma.listing.count({ where }),
    ]);
    res.json({ data: rows.map(card), meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { handle(res, err, 'searchListings'); }
}

export async function getPublicListing(req, res) {
  try {
    if (!UUID.test(req.params.uuid)) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    const viewer = req.user ? BigInt(req.user.id) : null;
    const listing = await prisma.listing.findFirst({
      where: { uuid: uuidToBuffer(req.params.uuid), status: 'published', deletedAt: null, owner: { deletedAt: null, deactivatedAt: null } },
      include: { ...listingInclude, owner: { select: { id: true, ...ownerSelect } } },
    });
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    const isOwner = viewer === listing.ownerId;
    if (viewer && !isOwner && (await blockedIds(prisma, viewer)).some((id) => id === listing.ownerId)) return res.status(404).json({ message: 'Anúncio não encontrado.' });

    const today = new Date();
    const horizon = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 120));
    const blocked = await prisma.professionalAvailability.findMany({ where: { professionalId: listing.ownerId, isAvailable: false, date: { gte: new Date(`${dateKey(today)}T00:00:00.000Z`), lte: horizon } }, select: { date: true } });
    const data = serialize(listing);
    const profile = listing.owner.professionalProfile;
    const ownerExtra = await ownerPageData(listing.ownerId, num(profile?.averageRating) ?? 0, profile?.totalReviews ?? 0);
    const busy = await busyForListing(listing.id, today);
    res.set('Cache-Control', 'no-store').json({
      ...data, isOwner, platformFeePercent: platformFeePercent(),
      owner: { uuid: bufferToUuid(listing.owner.uuid), name: nameOf(listing.owner), profilePictureUrl: listing.owner.profilePictureUrl, city: listing.owner.city, state: listing.owner.state, memberSince: listing.owner.createdAt, rating: num(profile?.averageRating) ?? 0, reviews: profile?.totalReviews ?? 0, verified: !!profile?.isVerified, ...ownerExtra },
      calendar: { earliest: earliestDate(today, data.availability?.leadTimeHours ?? 0), blocked: blocked.map((row) => row.date.toISOString().slice(0, 10)), busyHours: busy.hours, busyDays: busy.days },
    });
  } catch (err) { handle(res, err, 'getPublicListing'); }
}

// Ao excluir a conta, os anúncios saem do ar e os pedidos que ainda não começaram são cancelados.
registerDeletionStep(async (tx, userId, now) => {
  await tx.recentListingView.deleteMany({ where: { userId } });
  await tx.listing.updateMany({ where: { ownerId: userId, deletedAt: null }, data: { status: 'paused', deletedAt: now } });
  await tx.order.updateMany({ where: { OR: [{ clientId: userId }, { professionalId: userId }], status: 'requested' }, data: { status: 'cancelled', cancelledAt: now, cancelledById: userId } });
});

export async function getListingReviews(req, res) {
  try {
    const sort = ['recent', 'best', 'worst'].includes(req.query.ordem) ? req.query.ordem : 'recent';
    res.set('Cache-Control', 'no-store').json(await listingReviews(req.params.uuid, {
      sort, q: String(req.query.q ?? ''), page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(30, Math.max(1, Number(req.query.limit) || 10)),
    }));
  } catch (err) { if (err.status) return res.status(err.status).json({ message: err.message }); handle(res, err, 'getListingReviews'); }
}

export async function postListingReport(req, res) {
  try { res.status(201).json(await reportListing(BigInt(req.user.id), req.params.uuid, req.body)); } catch (err) { if (err.status) return res.status(err.status).json({ message: err.message }); handle(res, err, 'postListingReport'); }
}

export const reportReasons = (req, res) => res.json(Object.entries(REPORT_REASONS).map(([value, label]) => ({ value, label })));
