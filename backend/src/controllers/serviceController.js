import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

const STATUS_TRANSITIONS = {
  draft:       ['open', 'cancelled'],
  open:        ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   []
};

export const createService = async (req, res) => {
  const { title, description, category_id, budget_min, budget_max, deadline } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const service = await prisma.service.create({
      data: {
        uuid: generateUuid(),
        clientId: userId,
        categoryId: category_id,
        title,
        description,
        budgetMin: budget_min,
        budgetMax: budget_max,
        deadline,
        status: 'draft'
      },
      include: { category: true }
    });

    res.status(201).json({ ...service, uuid: bufferToUuid(service.uuid) });
  } catch (err) {
    logger.error('nome_da_função', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const listServices = async (req, res) => {
  const { category_id, budget_min, budget_max, page = 1, limit = 20 } = req.query;

  try {
    const where = {
      status: 'open',
      deletedAt: null,
      ...(category_id && { categoryId: Number(category_id) }),
      ...(budget_min && { budgetMax: { gte: Number(budget_min) } }),
      ...(budget_max && { budgetMin: { lte: Number(budget_max) } })
    };

    const [services, total] = await prisma.$transaction([
      prisma.service.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.service.count({ where })
    ]);

    res.json({
      data: services.map(s => ({ ...s, uuid: bufferToUuid(s.uuid) })),
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    logger.error('nome_da_função', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const getService = async (req, res) => {
  const { uuid } = req.params;
  console.log('uuid recebido:', uuid);
  console.log('buffer:', uuidToBuffer(uuid));
  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null },
      include: {
        category: true,
        client: {
          select: {
            uuid: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true
          }
        }
      }
    });
    console.log('service:', service);
    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    res.json({
      ...service,
      uuid: bufferToUuid(service.uuid),
      client: {
        ...service.client,
        uuid: bufferToUuid(service.client.uuid)
      }
    });
  } catch (err) {
    logger.error('nome_da_função', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateService = async (req, res) => {
  const { uuid } = req.params;
  const { title, description, category_id, budget_min, budget_max, deadline } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (service.clientId !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (service.status !== 'draft') {
      return res.status(400).json({ message: 'Apenas serviços em rascunho podem ser editados' });
    }

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: {
        title,
        description,
        categoryId: category_id,
        budgetMin: budget_min,
        budgetMax: budget_max,
        deadline
      },
      include: { category: true }
    });

    res.json({ ...updated, uuid: bufferToUuid(updated.uuid) });
  } catch (err) {
    logger.error('nome_da_função', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateStatus = async (req, res) => {
  const { uuid } = req.params;
  const { status } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (service.clientId !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const allowed = STATUS_TRANSITIONS[service.status];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Transição inválida: ${service.status} → ${status}. Permitido: ${allowed.join(', ') || 'nenhuma'}`
      });
    }

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { status }
    });

    res.json({ status: updated.status });
  } catch (err) {
    logger.error('nome_da_função', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const deleteService = async (req, res) => {
  const { uuid } = req.params;
  const userId = BigInt(req.user.id);

  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    if (service.clientId !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    if (service.status === 'in_progress') {
      return res.status(400).json({ message: 'Não é possível deletar um serviço em andamento' });
    }

    await prisma.service.update({
      where: { id: service.id },
      data: { deletedAt: new Date() }
    });

    res.status(204).send();
  } catch (err) {
    logger.error('nome_da_função', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};