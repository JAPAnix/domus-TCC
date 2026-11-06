import { prisma } from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { normalizeCity, normalizeOptionalText, normalizeState } from '../utils/userData.js';
import { connectionMap } from '../utils/connections.js';
import { blockedIds } from '../utils/blocks.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const me = (req) => BigInt(req.user.id);
const fullName = (user) => [user.firstName, user.lastName].filter(Boolean).join(' ');
const asList = (value) => (Array.isArray(value) ? value : []);

/** Nome que as outras pessoas veem: o nome de exibição, se houver. */
export const displayNameOf = (user) => user.preferredName?.trim() || fullName(user);

function completion(user) {
  const checks = [
    ['Foto de perfil', !!user.profilePictureUrl], ['Cidade', !!user.city], ['Sobre mim', !!user.about],
    ['Profissão', !!user.profession], ['Idiomas', asList(user.languages).length > 0], ['Interesses', asList(user.interests).length > 0],
  ];
  return { done: checks.filter(([, ok]) => ok).length, total: checks.length, missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}

const profileFields = (user) => ({
  uuid: bufferToUuid(user.uuid), firstName: user.firstName, lastName: user.lastName, preferredName: user.preferredName, displayName: displayNameOf(user),
  profilePictureUrl: user.profilePictureUrl, city: user.city, state: user.state, about: user.about, profession: user.profession, school: user.school,
  funFact: user.funFact, languages: asList(user.languages), interests: asList(user.interests), skills: asList(user.skills),
  serviceAreas: asList(user.serviceAreas), yearsExperience: user.yearsExperience, createdAt: user.createdAt,
});

function handle(res, err, label) {
  logger.error(label, err);
  res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}

export async function getMyProfile(req, res) {
  try {
    const user = await prisma.user.findFirst({ where: { id: me(req), deletedAt: null }, include: { roles: { include: { role: true } }, professionalProfile: { select: { userId: true } } } });
    if (!user) return res.status(401).json({ message: 'Conta indisponível. Entre novamente.' });
    res.set('Cache-Control', 'no-store').json({
      ...profileFields(user), roles: user.roles.map((item) => item.role.name), hasProfessionalProfile: !!user.professionalProfile, completion: completion(user),
    });
  } catch (err) { handle(res, err, 'getMyProfile'); }
}

export async function updateMyProfile(req, res) {
  try {
    const body = req.body;
    const data = {};
    const text = (key, column) => { if (key in body) data[column] = normalizeOptionalText(body[key] ?? ''); };
    text('about', 'about'); text('profession', 'profession'); text('school', 'school'); text('fun_fact', 'funFact');
    const list = (key, column) => {
      if (!(key in body)) return;
      const seen = new Set();
      const items = (body[key] ?? []).filter((item) => !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()));
      data[column] = items.length ? items : Prisma.DbNull;
    };
    list('languages', 'languages'); list('interests', 'interests'); list('skills', 'skills'); list('service_areas', 'serviceAreas');
    if ('years_experience' in body) data.yearsExperience = body.years_experience ?? null;
    if ('city' in body) data.city = normalizeCity(body.city ?? '');
    if ('state' in body) data.state = normalizeState(body.state ?? '');
    if ('profile_picture_url' in body) data.profilePictureUrl = body.profile_picture_url ?? null;
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nenhuma alteração enviada.' });
    await prisma.user.update({ where: { id: me(req) }, data });
    return getMyProfile(req, res);
  } catch (err) { handle(res, err, 'updateMyProfile'); }
}

const personCard = (user, extra = {}) => ({ uuid: bufferToUuid(user.uuid), name: displayNameOf(user), profilePictureUrl: user.profilePictureUrl, ...extra });

export async function listConnections(req, res) {
  try {
    const userId = me(req);
    const map = await connectionMap(prisma, userId);
    const excluded = new Set((await blockedIds(prisma, userId)).map(String));
    const ids = [...map.values()].map((entry) => entry.id).filter((id) => !excluded.has(id.toString()));
    const users = ids.length ? await prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null, deactivatedAt: null },
      select: { id: true, uuid: true, firstName: true, lastName: true, preferredName: true, profilePictureUrl: true, city: true, state: true, roles: { select: { role: { select: { name: true } } } } },
    }) : [];
    const rows = users.map((user) => {
      const entry = map.get(user.id.toString());
      return personCard(user, { location: [user.city, user.state].filter(Boolean).join(', ') || null, isProfessional: user.roles.some((item) => item.role.name === 'professional'), count: entry.count, lastAt: entry.last });
    }).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
    res.set('Cache-Control', 'no-store').json(rows);
  } catch (err) { handle(res, err, 'listConnections'); }
}

async function writtenReviews(userId, page, limit) {
  const where = { reviewerId: userId };
  const [rows, total] = await prisma.$transaction([
    prisma.review.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: {
        reviewed: { select: { uuid: true, firstName: true, lastName: true, preferredName: true, profilePictureUrl: true } },
        service: { select: { title: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({ id: row.id, rating: row.rating, comment: row.comment, createdAt: row.createdAt, context: row.service?.title ?? null, reviewed: personCard(row.reviewed) })),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

const pageParams = (req) => ({ page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(50, Math.max(1, Number(req.query.limit) || 10)) });

export async function myWrittenReviews(req, res) {
  try {
    const { page, limit } = pageParams(req);
    res.set('Cache-Control', 'no-store').json(await writtenReviews(me(req), page, limit));
  } catch (err) { handle(res, err, 'myWrittenReviews'); }
}

/**
 * Decide o que o visitante pode ver de um perfil.
 * Retorna { target, restricted } ou { status } quando o perfil não deve aparecer.
 */
async function resolveVisibility(req) {
  if (!UUID.test(req.params.uuid)) return { status: 404 };
  const viewerId = req.user ? me(req) : null;
  const target = await prisma.user.findFirst({
    where: { uuid: uuidToBuffer(req.params.uuid), deletedAt: null, deactivatedAt: null },
    include: {
      settings: { select: { profileVisibility: true, showWrittenReviews: true } },
      roles: { include: { role: true } },
      professionalProfile: { select: { averageRating: true, totalReviews: true, isVerified: true, headline: true, userId: true } },
    },
  });
  if (!target) return { status: 404 };
  const isSelf = viewerId === target.id;
  let iBlocked = false;
  if (viewerId && !isSelf) {
    const blocks = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: viewerId, blockedId: target.id }, { blockerId: target.id, blockedId: viewerId }] } });
    if (blocks.some((block) => block.blockerId === target.id)) return { status: 404 };
    iBlocked = blocks.length > 0;
  }
  const visibility = target.settings?.profileVisibility ?? 'everyone';
  let allowed = isSelf || visibility === 'everyone' || (visibility === 'members' && !!viewerId);
  if (!allowed && visibility === 'connections' && viewerId) allowed = (await connectionMap(prisma, viewerId)).has(target.id.toString());
  return { target, viewerId, isSelf, iBlocked, allowed, visibility };
}

export async function getPublicProfile(req, res) {
  try {
    const result = await resolveVisibility(req);
    if (result.status) return res.status(result.status).json({ message: 'Perfil não encontrado.' });
    const { target, isSelf, iBlocked, allowed, visibility } = result;
    const base = { uuid: bufferToUuid(target.uuid), name: displayNameOf(target), profilePictureUrl: target.profilePictureUrl, isSelf, viewerBlocked: iBlocked };
    if (!allowed) {
      return res.json({ ...base, restricted: true, restrictedReason: visibility === 'connections' ? 'Este perfil só é visível para pessoas com quem a pessoa já fechou negócio.' : 'Entre na sua conta para ver este perfil.' });
    }
    const professional = target.professionalProfile;
    res.set('Cache-Control', 'no-store').json({
      ...profileFields(target), ...base, restricted: false, memberSince: target.createdAt,
      isProfessional: target.roles.some((item) => item.role.name === 'professional') && !!professional,
      professional: professional ? { averageRating: Number(professional.averageRating), totalReviews: professional.totalReviews, isVerified: professional.isVerified, headline: professional.headline } : null,
      showsWrittenReviews: isSelf || target.settings?.showWrittenReviews !== false,
      // Dados de contato e documentos nunca fazem parte do perfil público.
      firstName: undefined, lastName: undefined, preferredName: undefined,
    });
  } catch (err) { handle(res, err, 'getPublicProfile'); }
}

export async function publicWrittenReviews(req, res) {
  try {
    const result = await resolveVisibility(req);
    if (result.status) return res.status(result.status).json({ message: 'Perfil não encontrado.' });
    if (!result.allowed) return res.status(403).json({ message: 'Este perfil é restrito.' });
    if (!result.isSelf && result.target.settings?.showWrittenReviews === false) return res.status(403).json({ message: 'Esta pessoa escolheu não mostrar as avaliações que escreveu.' });
    const { page, limit } = pageParams(req);
    res.json(await writtenReviews(result.target.id, page, limit));
  } catch (err) { handle(res, err, 'publicWrittenReviews'); }
}
