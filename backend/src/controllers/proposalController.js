import { prisma } from "../config/prisma.js";
import { uuidToBuffer, bufferToUuid, generateUuid } from "../utils/uuid.js";

export const createProposal = async (req, res) => {
  const { uuid: serviceUuid } = req.params;
  const { proposed_price, cover_letter, delivery_time_days } = req.body;
  const userId = req.user.id;

  try {
    const service = await prisma.services.findFirst({
      where: { uuid: uuidToBuffer(serviceUuid), deleted_at: null },
    });

    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }

    if (service.status !== "open") {
      return res
        .status(400)
        .json({ message: "Serviço não está aceitando propostas" });
    }

    // Profissional não pode propor no próprio serviço
    if (service.client_id === userId) {
      return res.status(400).json({
        message: "Você não pode enviar proposta no seu próprio serviço",
      });
    }

    const proposal = await prisma.proposals.create({
      data: {
        uuid: generateUuid(),
        service_id: service.id,
        professional_id: userId,
        proposed_price,
        cover_letter,
        delivery_time_days,
        status: "pending",
      },
    });

    res.status(201).json({
      ...proposal,
      uuid: bufferToUuid(proposal.uuid),
    });
  } catch (err) {
    // Unique constraint: profissional já enviou proposta para esse serviço
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ message: "Você já enviou uma proposta para esse serviço" });
    }
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const listProposals = async (req, res) => {
  const { uuid: serviceUuid } = req.params;
  const userId = req.user.id;

  try {
    const service = await prisma.services.findFirst({
      where: { uuid: uuidToBuffer(serviceUuid), deleted_at: null },
    });

    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }

    // Apenas o dono do serviço pode ver as propostas
    if (service.client_id !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const proposals = await prisma.proposals.findMany({
      where: { service_id: service.id },
      include: {
        professional_profiles: {
          include: {
            users: {
              select: {
                uuid: true,
                first_name: true,
                last_name: true,
                profile_picture_url: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    res.json(
      proposals.map((p) => ({
        ...p,
        uuid: bufferToUuid(p.uuid),
        professional_profiles: {
          ...p.professional_profiles,
          users: {
            ...p.professional_profiles.users,
            uuid: bufferToUuid(p.professional_profiles.users.uuid),
          },
        },
      })),
    );
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const getProposal = async (req, res) => {
  const { uuid } = req.params;
  const userId = req.user.id;

  try {
    const proposal = await prisma.proposals.findFirst({
      where: { uuid: uuidToBuffer(uuid) },
      include: {
        services: true,
        professional_profiles: {
          include: {
            users: {
              select: {
                uuid: true,
                first_name: true,
                last_name: true,
                profile_picture_url: true,
              },
            },
          },
        },
      },
    });

    if (!proposal) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    // Apenas o dono do serviço ou o profissional podem ver a proposta
    const isClient = proposal.services.client_id === userId;
    const isProfessional = proposal.professional_id === userId;

    if (!isClient && !isProfessional) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    res.json({
      ...proposal,
      uuid: bufferToUuid(proposal.uuid),
      professional_profiles: {
        ...proposal.professional_profiles,
        users: {
          ...proposal.professional_profiles.users,
          uuid: bufferToUuid(proposal.professional_profiles.users.uuid),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const updateProposalStatus = async (req, res) => {
  const { uuid } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  try {
    const proposal = await prisma.proposals.findFirst({
      where: { uuid: uuidToBuffer(uuid) },
      include: { services: true },
    });

    if (!proposal) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    if (proposal.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Apenas propostas pendentes podem ser alteradas" });
    }

    const isClient = proposal.services.client_id === userId;
    const isProfessional = proposal.professional_id === userId;

    // Cliente pode aceitar ou rejeitar
    if (isClient && !["accepted", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Cliente pode apenas aceitar ou rejeitar propostas" });
    }

    // Profissional pode apenas retirar
    if (isProfessional && status !== "withdrawn") {
      return res.status(400).json({
        message: "Profissional pode apenas retirar a própria proposta",
      });
    }

    if (!isClient && !isProfessional) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProposal = await tx.proposals.update({
        where: { id: proposal.id },
        data: { status },
      });

      // Ao aceitar, muda o serviço para in_progress e rejeita as demais propostas
      if (status === "accepted") {
        await tx.services.update({
          where: { id: proposal.service_id },
          data: { status: "in_progress" },
        });

        await tx.proposals.updateMany({
          where: {
            service_id: proposal.service_id,
            id: { not: proposal.id },
            status: "pending",
          },
          data: { status: "rejected" },
        });
      }

      return updatedProposal;
    });

    res.json({ status: updated.status });
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};
