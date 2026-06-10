import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

export const createProposal = async (req, res) => {
  const { uuid: serviceUuid } = req.params;
  const { proposed_price, cover_letter, delivery_time_days } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(serviceUuid), deletedAt: null }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (service.status !== 'open') {
      return res.status(400).json({ message: 'Serviço não está aceitando propostas' });
    }

    if (service.clientId === userId) {
      return res.status(400).json({ message: 'Você não pode enviar proposta no seu próprio serviço' });
    }

    const proposal = await prisma.proposal.create({
      data: {
        uuid: generateUuid(),
        serviceId: service.id,
        professionalId: userId,
        proposedPrice: proposed_price,
        coverLetter: cover_letter,
        deliveryTimeDays: delivery_time_days,
        status: 'pending'
      }
    });

    res.status(201).json({ ...proposal, uuid: bufferToUuid(proposal.uuid) });
  } catch (err) {
    logger.error('createProposal', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Você já enviou uma proposta para esse serviço' });
    }
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

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

export const updateProposalStatus = async (req, res) => {
  const { uuid } = req.params;
  const { status } = req.body;
  const userId = BigInt(req.user.id);



  try {
    const proposal = await prisma.proposal.findFirst({
      where: { uuid: uuidToBuffer(uuid) },
      include: { service: true }
    });

    if (!proposal) {
      return res.status(404).json({ message: 'Proposta não encontrada' });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ message: 'Apenas propostas pendentes podem ser alteradas' });
    }

    const isClient = proposal.service.clientId === userId;
    const isProfessional = proposal.professionalId === userId;

    if (!isClient && !isProfessional) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (isClient && !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Cliente pode apenas aceitar ou rejeitar propostas' });
    }

    if (isProfessional && status !== 'withdrawn') {
      return res.status(400).json({ message: 'Profissional pode apenas retirar a própria proposta' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProposal = await tx.proposal.update({
        where: { id: proposal.id },
        data: { status }
      });

      if (status === 'accepted') {
        await tx.service.update({
          where: { id: proposal.serviceId },
          data: { status: 'in_progress' }
        });

        await tx.proposal.updateMany({
          where: {
            serviceId: proposal.serviceId,
            id: { not: proposal.id },
            status: 'pending'
          },
          data: { status: 'rejected' }
        });
      }

      return updatedProposal;
    });

    res.json({ status: updated.status });
  } catch (err) {
    logger.error('updateProposalStatus', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};