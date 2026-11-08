import { prisma } from '../config/prisma.js';
import { bufferToUuid, uuidToBuffer } from '../utils/uuid.js';
import { blockersFor } from '../services/openRequests.js';
import { meetsPreferences } from '../utils/openRequestRules.js';

export function participation(service, userId, professional, proposal, order = null, extra = {}) {
  const isOwner = service.clientId === userId;
  const expired = !!service.expiresAt && service.expiresAt <= new Date();
  const limitReached = (extra.counted ?? 0) >= (service.maxProposals ?? 5);
  const reusable = !proposal || ['expired', 'withdrawn'].includes(proposal.status);
  const party = order && (order.clientId === userId || order.professionalId === userId);
  return {
    status: service.status, isOwner, isProfessional: professional,
    // Contratação criada quando a proposta foi aceita: é nela que fica o pagamento. Só as duas partes recebem o link.
    orderUuid: party ? bufferToUuid(order.uuid) : null,
    proposalStatus: proposal?.status ?? null, proposalUuid: proposal?.uuid ? bufferToUuid(proposal.uuid) : null,
    expiresAt: service.expiresAt ?? null, maxProposals: service.maxProposals ?? 5, proposalsCount: extra.counted ?? 0, limitReached,
    blockers: extra.blockers ?? [], preferencesOk: extra.preferencesOk ?? true,
    canSubmit: service.status === 'open' && !expired && !isOwner && professional && reusable && !limitReached && (extra.preferencesOk ?? true) && !(extra.blockers?.length)
  };
}
export async function getServiceParticipation(req, res, next) {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.uuid)) return res.status(400).json({ message: 'Serviço inválido.' });
    const userId = BigInt(req.user.id);
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { roles: { include: { role: true } } } });
    if (!user) return res.status(401).json({ message: 'Entre novamente para continuar.' });
    const service = await prisma.service.findFirst({ where: { uuid: uuidToBuffer(req.params.uuid), deletedAt: null }, select: { id: true, clientId: true, status: true, expiresAt: true, maxProposals: true, onlyVerified: true, minRating: true } });
    if (!service) return res.status(404).json({ message: 'Serviço não encontrado.' });
    const proposal = await prisma.proposal.findUnique({ where: { serviceId_professionalId: { serviceId: service.id, professionalId: userId } }, select: { status: true, uuid: true } });
    const order = await prisma.order.findUnique({ where: { serviceId: service.id }, select: { uuid: true, clientId: true, professionalId: true } });
    const isProfessional = user.roles.some(item => item.role.name === 'professional');
    const profile = isProfessional ? await prisma.professionalProfile.findUnique({ where: { userId }, select: { isVerified: true, averageRating: true } }) : null;
    const counted = await prisma.proposal.count({ where: { serviceId: service.id, status: { in: ['pending', 'accepted'] } } });
    const blockers = isProfessional && service.clientId !== userId ? await blockersFor(userId) : [];
    res.set('Cache-Control','no-store').json(participation(service, userId, isProfessional, proposal, order, { counted, blockers, preferencesOk: !profile || meetsPreferences(service, profile) }));
  } catch(err) { next(err); }
}
