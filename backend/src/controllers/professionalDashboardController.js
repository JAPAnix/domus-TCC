import { prisma } from '../config/prisma.js';
import { bufferToUuid } from '../utils/uuid.js';

export const getProfessionalDashboard = async (req, res, next) => {
  const page = Number(req.query.page ?? 1);
  const view = req.query.view ?? 'proposals';
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !['proposals', 'services'].includes(view)) {
    return res.status(400).json({ message: 'Filtros inválidos.' });
  }
  try {
    const base = { professionalId: BigInt(req.user.id), service: { deletedAt: null } };
    const ongoing = { ...base, status: 'accepted', service: { deletedAt: null, status: 'in_progress' } };
    const where = view === 'services' ? ongoing : base;
    const limit = 10;
    const [proposals, total, sent, pending, active] = await prisma.$transaction([
      prisma.proposal.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit, take: limit,
        select: {
          uuid: true, status: true, proposedPrice: true, deliveryTimeDays: true, createdAt: true,
          service: { select: {
            uuid: true, title: true, status: true,
            client: { select: { firstName: true, lastName: true } }
          } }
        }
      }),
      prisma.proposal.count({ where }),
      prisma.proposal.count({ where: base }),
      prisma.proposal.count({ where: { ...base, status: 'pending' } }),
      prisma.proposal.count({ where: ongoing })
    ]);
    res.json({
      data: proposals.map(proposal => ({
        ...proposal, uuid: bufferToUuid(proposal.uuid),
        service: { ...proposal.service, uuid: bufferToUuid(proposal.service.uuid) }
      })),
      meta: { page, pages: Math.ceil(total / limit), total },
      summary: { sent, pending, active }
    });
  } catch (err) { next(err); }
};
