import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import authMiddleware from '../middleware/authMiddleware.js';
const router = Router();
router.use(authMiddleware);
router.use(async (req, res, next) => {
  const user = await prisma.user.findFirst({ where: { id: BigInt(req.user.id), deletedAt: null }, select: { id: true } });
  if (!user) return res.status(401).json({ message: 'Conta indisponível.' });
  next();
});
router.get('/', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ message: 'Página inválida.' });
  const where = { userId: BigInt(req.user.id) };
  const [data, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page-1)*20, take: 20, select: { id: true, message: true, href: true, readAt: true, createdAt: true } }),
    prisma.notification.count({ where }), prisma.notification.count({ where: { ...where, readAt: null } })
  ]);
  res.set('Cache-Control', 'no-store').json({ data: data.map(n => ({ ...n, id: n.id.toString() })), unread, pages: Math.ceil(total/20) });
});
router.patch('/:id/read', async (req, res) => {
  if (!/^[1-9][0-9]{0,19}$/.test(req.params.id)) return res.status(400).json({ message: 'Notificação inválida.' });
  const where = { id: BigInt(req.params.id), userId: BigInt(req.user.id) };
  const item = await prisma.notification.findFirst({ where, select: { id: true } });
  if (!item) return res.status(404).json({ message: 'Notificação não encontrada.' });
  await prisma.notification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
  res.sendStatus(204);
});
export default router;
