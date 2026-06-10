import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';

export const createReview = async (req, res) => {
  const { uuid: serviceUuid } = req.params;
  const { reviewed_uuid, rating, comment } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(serviceUuid), deletedAt: null },
      include: {
        proposals: { where: { status: 'accepted' } }
      }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (service.status !== 'completed') {
      return res.status(400).json({ message: 'Só é possível avaliar serviços concluídos' });
    }

    const reviewedUser = await prisma.user.findFirst({
      where: { uuid: uuidToBuffer(reviewed_uuid), deletedAt: null }
    });

    if (!reviewedUser) {
      return res.status(404).json({ message: 'Usuário a ser avaliado não encontrado' });
    }

    const acceptedProposal = service.proposals[0];

    if (!acceptedProposal) {
      return res.status(400).json({ message: 'Nenhuma proposta aceita encontrada' });
    }

    const isClient = service.clientId === userId;
    const isProfessional = acceptedProposal.professionalId === userId;

    if (!isClient && !isProfessional) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (isClient && reviewedUser.id !== acceptedProposal.professionalId) {
      return res.status(400).json({ message: 'Cliente só pode avaliar o profissional do serviço' });
    }

    if (isProfessional && reviewedUser.id !== service.clientId) {
      return res.status(400).json({ message: 'Profissional só pode avaliar o cliente do serviço' });
    }

    if (userId === reviewedUser.id) {
      return res.status(400).json({ message: 'Você não pode avaliar a si mesmo' });
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          serviceId: service.id,
          reviewerId: userId,
          reviewedId: reviewedUser.id,
          rating,
          comment
        }
      });

      if (isClient) {
        const stats = await tx.review.aggregate({
          where: { reviewedId: reviewedUser.id },
          _avg: { rating: true },
          _count: { rating: true }
        });

        await tx.professionalProfile.update({
          where: { userId: reviewedUser.id },
          data: {
            averageRating: stats._avg.rating ?? 0,
            totalReviews: stats._count.rating
          }
        });
      }

      return created;
    });

    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Você já avaliou esse usuário nesse serviço' });
    }
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const listReviewsByUser = async (req, res) => {
  const { uuid } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const user = await prisma.user.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const where = { reviewedId: user.id };

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        include: {
          reviewer: {
            select: {
              uuid: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.review.count({ where })
    ]);

    res.json({
      data: reviews.map(r => ({
        ...r,
        reviewer: {
          ...r.reviewer,
          uuid: bufferToUuid(r.reviewer.uuid)
        }
      })),
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const listReviewsByService = async (req, res) => {
  const { uuid } = req.params;

  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    const reviews = await prisma.review.findMany({
      where: { serviceId: service.id },
      include: {
        reviewer: {
          select: {
            uuid: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true
          }
        },
        reviewed: {
          select: {
            uuid: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(
      reviews.map(r => ({
        ...r,
        reviewer: { ...r.reviewer, uuid: bufferToUuid(r.reviewer.uuid) },
        reviewed: { ...r.reviewed, uuid: bufferToUuid(r.reviewed.uuid) }
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};