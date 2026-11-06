import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

const me = (req) => BigInt(req.user.id);
const person = (user) => ({ uuid: bufferToUuid(user.uuid), name: [user.firstName, user.lastName].filter(Boolean).join(' '), profilePictureUrl: user.profilePictureUrl });

export async function listBlocks(req, res) {
  try {
    const rows = await prisma.userBlock.findMany({
      where: { blockerId: me(req) }, orderBy: { createdAt: 'desc' },
      include: { blocked: { select: { uuid: true, firstName: true, lastName: true, profilePictureUrl: true } } },
    });
    res.set('Cache-Control', 'no-store').json(rows.map((row) => ({ ...person(row.blocked), blockedAt: row.createdAt })));
  } catch (err) { logger.error('listBlocks', err); res.status(500).json({ message: 'Não foi possível carregar a lista.' }); }
}

export async function addBlock(req, res) {
  try {
    const target = await prisma.user.findFirst({ where: { uuid: uuidToBuffer(req.body.user_uuid), deletedAt: null }, select: { id: true } });
    if (!target) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (target.id === me(req)) return res.status(400).json({ message: 'Você não pode bloquear a si mesmo.' });
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: me(req), blockedId: target.id } },
      create: { blockerId: me(req), blockedId: target.id }, update: {},
    });
    res.status(201).json({ blocked: true });
  } catch (err) { logger.error('addBlock', err); res.status(500).json({ message: 'Não foi possível bloquear.' }); }
}

export async function removeBlock(req, res) {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.uuid)) return res.status(400).json({ message: 'Usuário inválido.' });
    const target = await prisma.user.findFirst({ where: { uuid: uuidToBuffer(req.params.uuid) }, select: { id: true } });
    if (!target) return res.status(404).json({ message: 'Usuário não encontrado.' });
    await prisma.userBlock.deleteMany({ where: { blockerId: me(req), blockedId: target.id } });
    res.json({ blocked: false });
  } catch (err) { logger.error('removeBlock', err); res.status(500).json({ message: 'Não foi possível desbloquear.' }); }
}
