import { receivingWarning } from '../services/payoutAccounts.js';
import { prisma } from '../config/prisma.js';
import { bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { maskDocument, onlyDigits } from '../utils/taxDocument.js';
import { dateKey } from '../utils/orderRules.js';
import { serializeOrder, orderInclude } from './orderController.js';

const me = (req) => BigInt(req.user.id);
const num = (value) => (value == null ? null : Number(value));

function handle(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const utcDay = (date) => new Date(`${dateKey(date)}T00:00:00.000Z`);

export async function summary(req, res) {
  try {
    const professionalId = me(req);
    const now = new Date();
    const [newOrders, inProgress, upcoming, month, profile, byStatus, openProposals, orderProposals] = await Promise.all([
      prisma.order.count({ where: { professionalId, status: 'requested' } }),
      prisma.order.count({ where: { professionalId, status: 'in_progress' } }),
      prisma.order.findMany({ where: { professionalId, status: { in: ['accepted', 'in_progress'] }, scheduledDate: { gte: utcDay(now) } }, orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }], take: 5, include: orderInclude }),
      prisma.order.aggregate({ where: { professionalId, status: 'completed', completedAt: { gte: startOfMonth(now) } }, _sum: { finalAmount: true }, _count: { _all: true } }),
      prisma.professionalProfile.findUnique({ where: { userId: professionalId }, select: { averageRating: true, totalReviews: true, isVerified: true } }),
      prisma.listing.groupBy({ by: ['status'], where: { ownerId: professionalId, deletedAt: null }, _count: { _all: true } }),
      prisma.proposal.count({ where: { professionalId, status: 'pending', service: { deletedAt: null } } }),
      prisma.order.count({ where: { professionalId, status: 'proposed' } }),
    ]);
    const proposalsPending = openProposals + orderProposals;
    res.set('Cache-Control', 'no-store').json({
      newOrders, inProgress, proposalsPending, receivingWarning: await receivingWarning(professionalId),
      monthEarnings: { amount: num(month._sum.finalAmount) ?? 0, count: month._count._all },
      rating: { average: num(profile?.averageRating) ?? 0, total: profile?.totalReviews ?? 0 },
      verified: !!profile?.isVerified,
      listings: Object.fromEntries(['draft', 'published', 'paused'].map((status) => [status, byStatus.find((row) => row.status === status)?._count._all ?? 0])),
      upcoming: upcoming.map((order) => serializeOrder(order, professionalId)),
    });
  } catch (err) { handle(res, err, 'pro.summary'); }
}

export async function earnings(req, res) {
  try {
    const professionalId = me(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 20;
    const since = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
    const where = { professionalId, status: 'completed' };
    const [recent, total, rows] = await prisma.$transaction([
      prisma.order.findMany({ where: { ...where, completedAt: { gte: since } }, select: { completedAt: true, finalAmount: true, platformFeePercent: true } }),
      prisma.order.count({ where }),
      prisma.order.findMany({ where, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit, include: orderInclude }),
    ]);
    const months = {};
    for (let i = 5; i >= 0; i--) {
      const date = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
      months[`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`] = { gross: 0, net: 0, count: 0 };
    }
    for (const order of recent) {
      const key = `${order.completedAt.getFullYear()}-${String(order.completedAt.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) continue;
      const gross = Number(order.finalAmount ?? 0);
      months[key].gross += gross;
      months[key].net += Math.round(gross * (100 - Number(order.platformFeePercent))) / 100;
      months[key].count += 1;
    }
    res.set('Cache-Control', 'no-store').json({
      months: Object.entries(months).map(([month, values]) => ({ month, ...values })),
      data: rows.map((row) => serializeOrder(row, professionalId)),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) { handle(res, err, 'pro.earnings'); }
}

async function requireProfile(professionalId) {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId: professionalId }, select: { userId: true } });
  if (!profile) throw Object.assign(new Error('Publique o seu primeiro anúncio para usar a agenda.'), { status: 403 });
}

export async function availability(req, res) {
  try {
    const professionalId = me(req);
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month)) ? String(req.query.month) : dateKey(new Date()).slice(0, 7);
    const [year, monthIndex] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthIndex - 1, 1));
    const last = new Date(Date.UTC(year, monthIndex, 0));
    const [blocked, orders] = await Promise.all([
      prisma.professionalAvailability.findMany({ where: { professionalId, isAvailable: false, date: { gte: first, lte: last } }, select: { date: true } }),
      prisma.order.findMany({ where: { professionalId, status: { in: ['requested', 'accepted', 'in_progress'] }, scheduledDate: { gte: first, lte: last } }, include: orderInclude, orderBy: { scheduledDate: 'asc' } }),
    ]);
    res.set('Cache-Control', 'no-store').json({ month, blocked: blocked.map((row) => row.date.toISOString().slice(0, 10)), orders: orders.map((order) => serializeOrder(order, professionalId)) });
  } catch (err) { handle(res, err, 'pro.availability'); }
}

export async function setBlockedDate(req, res) {
  try {
    const professionalId = me(req);
    const day = req.params.date;
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00.000Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return res.status(400).json({ message: 'Data inválida.' });
    if (day < dateKey(new Date())) return res.status(400).json({ message: 'Não é possível alterar uma data que já passou.' });
    await requireProfile(professionalId);
    if (req.body.blocked) {
      await prisma.professionalAvailability.upsert({
        where: { professionalId_date: { professionalId, date: parsed } },
        create: { professionalId, date: parsed, isAvailable: false }, update: { isAvailable: false },
      });
    } else {
      await prisma.professionalAvailability.deleteMany({ where: { professionalId, date: parsed, isAvailable: false } });
    }
    res.json({ date: day, blocked: !!req.body.blocked });
  } catch (err) { handle(res, err, 'pro.setBlockedDate'); }
}

export async function getVerification(req, res) {
  try {
    const userId = me(req);
    const [verification, settings, profile] = await Promise.all([
      prisma.professionalVerification.findUnique({ where: { userId } }),
      prisma.userSettings.findUnique({ where: { userId }, select: { taxDocument: true, taxDocumentType: true } }),
      prisma.professionalProfile.findUnique({ where: { userId }, select: { isVerified: true } }),
    ]);
    res.set('Cache-Control', 'no-store').json({
      submitted: !!verification, status: profile?.isVerified ? 'approved' : verification?.status ?? null, verified: !!profile?.isVerified,
      legalName: verification?.legalName ?? null, documentType: verification?.documentType ?? null, documentMasked: maskDocument(verification?.documentType, settings?.taxDocument),
    });
  } catch (err) { handle(res, err, 'pro.getVerification'); }
}

export async function saveVerification(req, res) {
  try {
    const userId = me(req);
    const { legal_name: legalName, document_type: documentType, document } = req.body;
    const digits = onlyDigits(document);
    const [settings, current] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId }, select: { taxDocument: true } }),
      prisma.professionalVerification.findUnique({ where: { userId } }),
    ]);
    // Se o documento não mudou e já foi aprovado, a aprovação continua valendo.
    const unchanged = current?.status === 'approved' && current.documentType === documentType && settings?.taxDocument === digits;
    const taxData = { taxDocumentType: documentType, taxDocument: digits, taxHolderName: legalName };
    await prisma.$transaction([
      prisma.userSettings.upsert({ where: { userId }, create: { userId, ...taxData }, update: taxData }),
      prisma.professionalVerification.upsert({
        where: { userId }, create: { userId, legalName, documentType },
        update: { legalName, documentType, ...(unchanged ? {} : { status: 'pending', submittedAt: new Date(), reviewedAt: null }) },
      }),
      ...(unchanged ? [] : [prisma.professionalProfile.updateMany({ where: { userId }, data: { isVerified: false } })]),
    ]);
    return getVerification(req, res);
  } catch (err) { handle(res, err, 'pro.saveVerification'); }
}

export { bufferToUuid };
