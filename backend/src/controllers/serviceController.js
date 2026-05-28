import { prisma } from "../config/prisma.js";
import { uuidToBuffer, bufferToUuid, generateUuid } from "../utils/uuid.js";

// Ciclo de vida válido por status atual
const STATUS_TRANSITIONS = {
  draft: ["open", "cancelled"],
  open: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const createService = async (req, res) => {
  const { title, description, category_id, budget_min, budget_max, deadline } =
    req.body;
  const userId = req.user.id;

  try {
    const service = await prisma.services.create({
      data: {
        uuid: uuidToBuffer(crypto.randomUUID()),
        client_id: userId,
        category_id,
        title,
        description,
        budget_min,
        budget_max,
        deadline,
        status: "draft",
      },
      include: {
        categories: true,
      },
    });

    res.status(201).json({
      ...service,
      uuid: bufferToUuid(service.uuid),
    });
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const listServices = async (req, res) => {
  const {
    category_id,
    budget_min,
    budget_max,
    page = 1,
    limit = 20,
  } = req.query;

  try {
    const where = {
      status: "open",
      deleted_at: null,
      ...(category_id && { category_id: Number(category_id) }),
      ...(budget_min && { budget_max: { gte: Number(budget_min) } }),
      ...(budget_max && { budget_min: { lte: Number(budget_max) } }),
    };

    const [services, total] = await prisma.$transaction([
      prisma.services.findMany({
        where,
        include: { categories: true },
        orderBy: { created_at: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.services.count({ where }),
    ]);

    res.json({
      data: services.map((s) => ({ ...s, uuid: bufferToUuid(s.uuid) })),
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const getService = async (req, res) => {
  const { uuid } = req.params;

  try {
    const service = await prisma.services.findFirst({
      where: {
        uuid: uuidToBuffer(uuid),
        deleted_at: null,
      },
      include: {
        categories: true,
        users: {
          select: {
            uuid: true,
            first_name: true,
            last_name: true,
            profile_picture_url: true,
          },
        },
      },
    });

    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }

    res.json({
      ...service,
      uuid: bufferToUuid(service.uuid),
      users: {
        ...service.users,
        uuid: bufferToUuid(service.users.uuid),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const updateService = async (req, res) => {
  const { uuid } = req.params;
  const { title, description, category_id, budget_min, budget_max, deadline } =
    req.body;
  const userId = req.user.id;

  try {
    const service = await prisma.services.findFirst({
      where: { uuid: uuidToBuffer(uuid), deleted_at: null },
    });

    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }

    if (service.client_id !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    if (service.status !== "draft") {
      return res
        .status(400)
        .json({ message: "Apenas serviços em rascunho podem ser editados" });
    }

    const updated = await prisma.services.update({
      where: { id: service.id },
      data: {
        title,
        description,
        category_id,
        budget_min,
        budget_max,
        deadline,
      },
      include: { categories: true },
    });

    res.json({ ...updated, uuid: bufferToUuid(updated.uuid) });
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const updateStatus = async (req, res) => {
  const { uuid } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  try {
    const service = await prisma.services.findFirst({
      where: { uuid: uuidToBuffer(uuid), deleted_at: null },
    });

    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }

    if (service.client_id !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const allowed = STATUS_TRANSITIONS[service.status];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Transição inválida: ${service.status} → ${status}. Permitido: ${allowed.join(", ") || "nenhuma"}`,
      });
    }

    const updated = await prisma.services.update({
      where: { id: service.id },
      data: { status },
    });

    res.json({ status: updated.status });
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const deleteService = async (req, res) => {
  const { uuid } = req.params;
  const userId = req.user.id;

  try {
    const service = await prisma.services.findFirst({
      where: { uuid: uuidToBuffer(uuid), deleted_at: null },
    });

    if (!service) {
      return res.status(404).json({ message: "Serviço não encontrado" });
    }

    if (service.client_id !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    if (service.status === "in_progress") {
      return res
        .status(400)
        .json({ message: "Não é possível deletar um serviço em andamento" });
    }

    await prisma.services.update({
      where: { id: service.id },
      data: { deleted_at: new Date() },
    });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};
