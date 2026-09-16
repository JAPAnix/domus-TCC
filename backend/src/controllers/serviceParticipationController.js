import { prisma } from '../config/prisma.js';
import { uuidToBuffer } from '../utils/uuid.js';

export function participation(service, userId, professional, proposal) {
  const isOwner = service.clientId === userId;
  return {
    status: service.status, isOwner, isProfessional: professional,
    proposalStatus: proposal?.status ?? null,
    canSubmit: service.status === 'open' && !isOwner && professional && !proposal
  };
}
export async function getServiceParticipation(req, res, next) {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.uuid)) return res.status(400).json({ message: 'Serviço inválido.' });
    const userId = BigInt(req.user.id);
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { roles: { include: { role: true } } } });
    if (!user) return res.status(401).json({ message: 'Entre novamente para continuar.' });
    const service = await prisma.service.findFirst({ where: { uuid: uuidToBuffer(req.params.uuid), deletedAt: null }, select: { id: true, clientId: true, status: true } });
    if (!service) return res.status(404).json({ message: 'Serviço não encontrado.' });
    const proposal = await prisma.proposal.findUnique({ where: { serviceId_professionalId: { serviceId: service.id, professionalId: userId } }, select: { status: true } });
    res.set('Cache-Control','no-store').json(participation(service, userId, user.roles.some(item => item.role.name === 'professional'), proposal));
  } catch(err) { next(err); }
}
