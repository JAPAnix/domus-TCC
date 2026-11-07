import { changeServiceStatus, workflowHandler } from '../services/serviceWorkflow.js';
import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';


const imagesInclude = { images: { orderBy: { sortOrder: 'asc' }, select: { url: true } } };

function serializeService(service) {
  return {
    ...service,
    uuid: bufferToUuid(service.uuid),
    images: service.images?.map((image) => image.url) ?? [],
    ...(service.client && { client: { ...service.client, uuid: bufferToUuid(service.client.uuid) } }),
  };
}

function imageRows(urls) {
  return urls.map((url, sortOrder) => ({ url, sortOrder }));
}

export const createService = async (req, res) => {
  const { title, description, category_id, budget_min, budget_max, deadline, image_urls, city, state, neighborhood } = req.body;
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
        city,
        state,
        neighborhood: neighborhood || null,
        status: 'open',
        ...(image_urls?.length && { images: { create: imageRows(image_urls) } })
      },
      include: { category: true, ...imagesInclude }
    });

    res.status(201).json(serializeService(service));
  } catch (err) {
    logger.error('createService', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const listServices = async (req, res) => {
  const { category_id, budget_min, budget_max } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 20));

  try {
    const where = {
      deletedAt: null,
      status: 'open',
      client: { deactivatedAt: null },
      ...(category_id && { categoryId: Number(category_id) }),
      ...(budget_min && { budgetMax: { gte: Number(budget_min) } }),
      ...(budget_max && { budgetMin: { lte: Number(budget_max) } })
    };

    const [services, total] = await prisma.$transaction([
      prisma.service.findMany({
        where,
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
          client: {
            select: {
              uuid: true,
              firstName: true,
              lastName: true,
              profilePictureUrl: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.service.count({ where })
    ]);

    res.json({
      data: services.map(serializeService),
      meta: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('listServices', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

/** Pedidos do próprio usuário, em qualquer status. */
export const listMyServices = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 20));
  const where = { clientId: BigInt(req.user.id), deletedAt: null };

  try {
    const [services, total] = await prisma.$transaction([
      prisma.service.findMany({
        where,
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
          _count: { select: { proposals: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.service.count({ where })
    ]);

    res.json({
      data: services.map(serializeService),
      meta: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('listMyServices', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const getService = async (req, res) => {
  const { uuid } = req.params;
  try {
    const service = await prisma.service.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null },
      include: {
        category: true,
        ...imagesInclude,
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
    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    res.json(serializeService(service));
  } catch (err) {
    logger.error('getService', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateService = async (req, res) => {
  const { uuid } = req.params;
  const { title, description, category_id, budget_min, budget_max, deadline, image_urls, city, state, neighborhood } = req.body;
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
        deadline,
        city,
        state,
        neighborhood,
        ...(image_urls !== undefined && { images: { deleteMany: {}, create: imageRows(image_urls) } })
      },
      include: { category: true, ...imagesInclude }
    });

    res.json(serializeService(updated));
  } catch (err) {
    logger.error('updateService', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateStatus = workflowHandler((uuid, id, body) => changeServiceStatus(uuid, id, body.status));

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
    logger.error('deleteService', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};
