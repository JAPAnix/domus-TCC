import { submitProposal, decideProposal, workflowHandler } from '../services/serviceWorkflow.js';
import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

export const createProposal = workflowHandler(submitProposal, 201);

export const listProposals = async (req, res) => {
  const { uuid: serviceUuid } = req.params;
  const userId = BigInt(req.user.id);

  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(serviceUuid), deletedAt: null }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (service.clientId !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const proposals = await prisma.proposal.findMany({
      where: { serviceId: service.id },
      include: {
        professional: {
          include: {
            user: {
              select: {
                uuid: true,
                firstName: true,
                lastName: true,
                profilePictureUrl: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(
      proposals.map(p => ({
        ...p,
        uuid: bufferToUuid(p.uuid),
        professional: {
          ...p.professional,
          user: {
            ...p.professional.user,
            uuid: bufferToUuid(p.professional.user.uuid)
          }
        }
      }))
    );
  } catch (err) {
    logger.error('listProposals', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const getProposal = async (req, res) => {
  const { uuid } = req.params;
  const userId = BigInt(req.user.id);

  try {
    const proposal = await prisma.proposal.findFirst({
      where: { uuid: uuidToBuffer(uuid) },
      include: {
        service: true,
        professional: {
          include: {
            user: {
              select: {
                uuid: true,
                firstName: true,
                lastName: true,
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });

    if (!proposal) {
      return res.status(404).json({ message: 'Proposta não encontrada' });
    }

    const isClient = proposal.service.clientId === userId;
    const isProfessional = proposal.professionalId === userId;

    if (!isClient && !isProfessional) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    res.json({
      ...proposal,
      uuid: bufferToUuid(proposal.uuid),
      professional: {
        ...proposal.professional,
        user: {
          ...proposal.professional.user,
          uuid: bufferToUuid(proposal.professional.user.uuid)
        }
      }
    });
  } catch (err) {
    logger.error('getProposal', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateProposalStatus = workflowHandler((uuid, id, body) => decideProposal(uuid, id, body.status));