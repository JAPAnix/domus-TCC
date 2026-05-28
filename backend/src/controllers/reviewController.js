import prisma from '../config/database.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';

export const createReview = async (req, res) => {
  const { uuid: serviceUuid } = req.params;
  const { reviewed_uuid, rating, comment } = req.body;
  const userId = req.user.id;

  try {
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating deve ser entre 1 e 5' });
    }

    const service = await prisma.services.findFirst({
      where: { uuid: uuidToBuffer(serviceUuid), deleted_at: null },
      include: {
        proposals: {
          where: { status: 'accepted' }
        }
      }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (service.status !== 'completed') {
      return res.status(400).json({ message: 'Só é possível avaliar serviços concluídos' });
    }

    // Busca o usuário a ser avaliado
    const reviewedUser = await prisma.users.findFirst({
      where: { uuid: uuidToBuffer(reviewed_uuid), deleted_at: null }
    });

    if (!reviewedUser) {
      return res.status(404).json({ message: 'Usuário a ser avaliado não encontrado' });
    }

    const isClient = service.client_id === userId;
    const acceptedProposal = service.proposals[0];

    if (!acceptedProposal) {
      return res.status(400).json({ message: 'Nenhuma proposta aceita encontrada para esse serviço' });
    }

    const isProfessional = acceptedProposal.professional_id === userId;

    // Apenas cliente ou profissional envolvido no serviço podem avaliar
    if (!isClient && !isProfessional) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // Cliente só pode avaliar o profissional e vice-versa
    if (isClient && reviewedUser.id !== acceptedProposal.professional_id) {
      return res.status(400).json({ message: 'Cliente só pode avaliar o profissional do serviço' });
    }

    if (isProfessional && reviewedUser.id !== service.client_id) {
      return res.status(400).json({ message: 'Profissional só pode avaliar o cliente do serviço' });
    }

    // Não pode avaliar a si mesmo
    if (userId === reviewedUser.id) {
      return res.status(400).json({ message: 'Você não pode avaliar a si mesmo' });
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.reviews.create({
        data: {
          service_id: service.id,
          reviewer_id: userId,
          reviewed_id: reviewedUser.id,
          rating,
          comment
        }
      });

      // Atualiza average_rating e total_reviews no perfil profissional
      if (isClient) {
        const stats = await tx.reviews.aggregate({
          where: { reviewed_id: reviewedUser.id },
          _avg: { rating: true },
          _count: { rating: true }
        });

        await tx.professional_profiles.update({
          where: { user_id: reviewedUser.id },
          data: {
            average_rating: stats._avg.rating ?? 0,
            total_reviews: stats._count.rating
          }
        });
      }

      return created;
    });

    res.status(201).json(review);
  } catch (err) {
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
    const user = await prisma.users.findFirst({
      where: { uuid: uuidToBuffer(uuid), deleted_at: null }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const where = { reviewed_id: user.id };

    const [reviews, total] = await prisma.$transaction([
      prisma.reviews.findMany({
        where,
        include: {
          users_reviews_reviewer_idTousers: {
            select: {
              uuid: true,
              first_name: true,
              last_name: true,
              profile_picture_url: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.reviews.count({ where })
    ]);

    res.json({
      data: reviews.map(r => ({
        ...r,
        reviewer: {
          ...r.users_reviews_reviewer_idTousers,
          uuid: bufferToUuid(r.users_reviews_reviewer_idTousers.uuid)
        },
        users_reviews_reviewer_idTousers: undefined
      })),
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const listReviewsByService = async (req, res) => {
  const { uuid } = req.params;

  try {
    const service = await prisma.services.findFirst({
      where: { uuid: uuidToBuffer(uuid), deleted_at: null }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    const reviews = await prisma.reviews.findMany({
      where: { service_id: service.id },
      include: {
        users_reviews_reviewer_idTousers: {
          select: {
            uuid: true,
            first_name: true,
            last_name: true,
            profile_picture_url: true
          }
        },
        users_reviews_reviewed_idTousers: {
          select: {
            uuid: true,
            first_name: true,
            last_name: true,
            profile_picture_url: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(
      reviews.map(r => ({
        ...r,
        reviewer: {
          ...r.users_reviews_reviewer_idTousers,
          uuid: bufferToUuid(r.users_reviews_reviewer_idTousers.uuid)
        },
        reviewed: {
          ...r.users_reviews_reviewed_idTousers,
          uuid: bufferToUuid(r.users_reviews_reviewed_idTousers.uuid)
        },
        users_reviews_reviewer_idTousers: undefined,
        users_reviews_reviewed_idTousers: undefined
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};