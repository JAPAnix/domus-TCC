import { submitReview, workflowHandler } from '../services/serviceWorkflow.js';
import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

export const createReview = workflowHandler(submitReview, 201);

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
    logger.error('listReviewsByUser', err);
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
    logger.error('listReviewsByService', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};