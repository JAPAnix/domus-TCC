import { changeServiceStatus, workflowHandler } from '../services/serviceWorkflow.js';
import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { createOpenRequest, cleanRequestText, renewOpenRequest, getDraft, saveDraft, clearDraft, reportRequest, clientSummary } from '../services/openRequests.js';
import { openRequestConfig } from '../config/openRequests.js';


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
  try {
    const { service, masked } = await createOpenRequest(BigInt(req.user.id), req.body);
    res.status(201).json({ ...serializeService(service), masked });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('createService', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

const handle = (label, work, status = 200) => async (req, res) => {
  try {
    const result = await work(req);
    if (status === 204) return res.status(204).end();
    return res.status(status).set('Cache-Control', 'no-store').json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error(label, err);
    return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
  }
};
export const draftGet = handle('draftGet', async (req) => ({ data: await getDraft(BigInt(req.user.id)) }));
export const draftPut = handle('draftPut', (req) => saveDraft(BigInt(req.user.id), req.body.data));
export const draftDelete = handle('draftDelete', async (req) => { await clearDraft(BigInt(req.user.id)); }, 204);
export const renew = handle('renew', (req) => renewOpenRequest(req.params.uuid, BigInt(req.user.id), req.body.days));
export const report = handle('reportRequest', (req) => reportRequest(BigInt(req.user.id), req.params.uuid, { reason: req.body.reason, details: req.body.details, proposalUuid: req.body.proposal_uuid }), 201);

/** Regras e limites do pedido aberto, para as telas (público). */
export const features = (req, res) => {
  const config = openRequestConfig();
  res.set('Cache-Control', 'public, max-age=60').json({ openRequests: config.enabled, openRequestDefaults: { validityDays: config.validityDays, defaultDays: config.defaultDays, maxProposals: config.maxProposals, maxPerDay: config.maxPerDay } });
};

/** Detalhe de uma oportunidade para o profissional: o pedido, a nota do cliente e quantas propostas já recebeu. */
export const opportunityDetail = handle('opportunityDetail', async (req) => {
  const service = await prisma.service.findFirst({
    where: { uuid: uuidToBuffer(req.params.uuid), deletedAt: null, status: { not: 'removed' } },
    include: { category: true, ...imagesInclude, client: { select: { id: true, uuid: true, firstName: true, lastName: true, preferredName: true, profilePictureUrl: true } }, proposals: { select: { status: true } } },
  });
  if (!service) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });
  const summary = await clientSummary(service.client.id);
  const { id: _id, ...client } = service.client;
  const { proposals, ...rest } = service;
  return {
    ...serializeService({ ...rest, client }),
    proposalsCount: proposals.filter((proposal) => ['pending', 'accepted'].includes(proposal.status)).length,
    client: { ...client, uuid: bufferToUuid(client.uuid), ...summary },
  };
});

export const listServices = async (req, res) => {
  const { category_id, budget_min, budget_max } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 20));

  try {
    const where = {
      deletedAt: null,
      status: 'open',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
          _count: { select: { proposals: true } },
          proposals: { where: { status: 'pending' }, select: { id: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.service.count({ where })
    ]);

    res.json({
      data: services.map(({ proposals, ...service }) => ({ ...serializeService(service), pendingProposals: proposals.length })),
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
    if (!service || service.status === 'removed') {
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

    if (!['draft', 'open'].includes(service.status)) {
      return res.status(400).json({ message: 'Só dá para editar pedidos em rascunho ou abertos' });
    }
    const cleaned = cleanRequestText({ title, description });

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: {
        title: cleaned.title,
        description: cleaned.description,
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
