import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';
import { normalizeCity, normalizeState } from '../utils/userData.js';

function datesForDatabase(dates = []) {
  return [...new Set(dates)].map((date) => new Date(`${date}T12:00:00`));
}

async function validateCatalogItems(tx, ids) {
  if (!ids?.length) return [];
  const items = await tx.serviceCatalogItem.findMany({
    where: { id: { in: ids }, active: true },
    select: { id: true }
  });
  if (items.length !== new Set(ids).size) {
    throw new Error('Um ou mais serviços selecionados não existem ou estão inativos.');
  }
  return items;
}

function assertPublishable({ city, hourlyRate, dailyRate, catalogServiceIds }) {
  if (!city) throw new Error('Informe a cidade de atendimento antes de publicar.');
  if (!catalogServiceIds.length) throw new Error('Selecione pelo menos um serviço antes de publicar.');
  if (Number(hourlyRate) <= 0 && (dailyRate == null || Number(dailyRate) <= 0)) {
    throw new Error('Defina um preço por hora ou por diária antes de publicar.');
  }
}

export const createProfile = async (req, res) => {
  const { headline, bio, hourly_rate, daily_rate, skills, catalog_service_ids, availability_dates, city, state, publish = false } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const existing = await prisma.professionalProfile.findUnique({
      where: { userId }
    });

    if (existing) {
      return res.status(409).json({ message: 'Perfil profissional já existe' });
    }

    const profile = await prisma.$transaction(async (tx) => {
      const catalogItems = await validateCatalogItems(tx, catalog_service_ids);
      const user = await tx.user.findUnique({ where: { id: userId }, select: { city: true } });
      const normalizedCity = normalizeCity(city);
      if (publish) assertPublishable({ city: normalizedCity ?? user.city, hourlyRate: hourly_rate, dailyRate: daily_rate, catalogServiceIds: catalogItems.map((item) => item.id) });
      if (normalizedCity !== undefined || state !== undefined) {
        await tx.user.update({ where: { id: userId }, data: { ...(normalizedCity !== undefined && { city: normalizedCity }), ...(state !== undefined && { state: normalizeState(state) }) } });
      }
      const created = await tx.professionalProfile.create({
        data: {
          userId, headline, bio, hourlyRate: hourly_rate, dailyRate: daily_rate, isPublished: publish,
          skills: skills?.length ? { create: skills.map((skill) => ({ skillId: skill.skill_id, proficiencyLevel: skill.proficiency_level ?? 'intermediate' })) } : undefined,
          catalogServices: catalogItems.length ? { create: catalogItems.map((item) => ({ catalogItemId: item.id })) } : undefined,
          availabilityEntries: availability_dates?.length ? { create: datesForDatabase(availability_dates).map((date) => ({ date, isAvailable: true })) } : undefined
        },
        include: { skills: { include: { skill: true } }, catalogServices: { include: { catalogItem: true } }, availabilityEntries: true }
      });
      const professionalRole = await tx.role.upsert({ where: { name: 'professional' }, update: {}, create: { name: 'professional' } });
      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId: professionalRole.id
          }
        },
        update: {},
        create: { userId, roleId: professionalRole.id }
      });
      return created;
    });

    res.status(201).json(profile);
  } catch (err) {
    if (err.message?.includes('selecionados') || err.message?.includes('antes de publicar')) return res.status(422).json({ message: err.message });
    logger.error('createProfile', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const getProfile = async (req, res) => {
  const { uuid } = req.params;

  try {
    const user = await prisma.user.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null },
      select: {
        uuid: true,
        firstName: true,
        lastName: true,
        profilePictureUrl: true,
        city: true,
        state: true,
        professionalProfile: {
          include: {
            skills: {
              include: { skill: true }
            },
            catalogServices: { include: { catalogItem: { include: { category: true } } } },
            availabilityEntries: true
          }
        }
      }
    });

    if (!user || !user.professionalProfile) {
      return res.status(404).json({ message: 'Perfil profissional não encontrado' });
    }

    res.json({
      uuid: bufferToUuid(user.uuid),
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      city: user.city,
      state: user.state,
      ...user.professionalProfile
    });
  } catch (err) {
    logger.error('getProfile', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateProfile = async (req, res) => {
  const { uuid } = req.params;
  const { headline, bio, hourly_rate, daily_rate, skills, catalog_service_ids, availability_dates, city, state, publish } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const user = await prisma.user.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!user || user.id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const profile = await prisma.$transaction(async (tx) => {
      const existing = await tx.professionalProfile.findUnique({ where: { userId }, include: { catalogServices: true, user: { select: { city: true } } } });
      if (!existing) throw new Error('Perfil profissional não encontrado.');
      const catalogItems = await validateCatalogItems(tx, catalog_service_ids);
      const normalizedCity = normalizeCity(city);
      const effectiveCatalogIds = catalog_service_ids === undefined ? existing.catalogServices.map((item) => item.catalogItemId) : catalogItems.map((item) => item.id);
      const effectiveHourlyRate = hourly_rate ?? existing.hourlyRate;
      const effectiveDailyRate = daily_rate === undefined ? existing.dailyRate : daily_rate;
      if (publish === true) assertPublishable({ city: normalizedCity ?? existing.user.city, hourlyRate: effectiveHourlyRate, dailyRate: effectiveDailyRate, catalogServiceIds: effectiveCatalogIds });
      if (normalizedCity !== undefined || state !== undefined) await tx.user.update({ where: { id: userId }, data: { ...(normalizedCity !== undefined && { city: normalizedCity }), ...(state !== undefined && { state: normalizeState(state) }) } });
      return tx.professionalProfile.update({
        where: { userId },
        data: {
          ...(headline !== undefined && { headline }), ...(bio !== undefined && { bio }), ...(hourly_rate !== undefined && { hourlyRate: hourly_rate }), ...(daily_rate !== undefined && { dailyRate: daily_rate }), ...(publish !== undefined && { isPublished: publish }),
          ...(skills !== undefined && { skills: { deleteMany: {}, create: skills.map((skill) => ({ skillId: skill.skill_id, proficiencyLevel: skill.proficiency_level ?? 'intermediate' })) } }),
          ...(catalog_service_ids !== undefined && { catalogServices: { deleteMany: {}, create: catalogItems.map((item) => ({ catalogItemId: item.id })) } }),
          ...(availability_dates !== undefined && { availabilityEntries: { deleteMany: {}, create: datesForDatabase(availability_dates).map((date) => ({ date, isAvailable: true })) } })
        },
        include: { skills: { include: { skill: true } }, catalogServices: { include: { catalogItem: { include: { category: true } } } }, availabilityEntries: true }
      });
    });

    res.json(profile);
  } catch (err) {
    if (err.message?.includes('selecionados') || err.message?.includes('antes de publicar') || err.message?.includes('não encontrado')) return res.status(422).json({ message: err.message });
    logger.error('updateProfile', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateAvailability = async (req, res) => {
  const { uuid } = req.params;
  const { availability_status } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const user = await prisma.user.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!user || user.id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const profile = await prisma.professionalProfile.update({
      where: { userId },
      data: { availabilityStatus: availability_status }
    });

    res.json({ availabilityStatus: profile.availabilityStatus });
  } catch (err) {
    logger.error('updateAvailability', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const searchProfessionals = async (req, res) => {
  const { city, date, serviceId, page = 1, limit = 12 } = req.query;

  if (!city || !date) return res.status(400).json({ message: 'Cidade e data são obrigatórias.' });

  const searchDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(searchDate.getTime())) return res.status(400).json({ message: 'Data inválida.' });

  const where = {
    isPublished: true,
    availabilityStatus: 'available',
    user: { city, deletedAt: null },
    availabilityEntries: { none: { date: searchDate, isAvailable: false } },
    ...(serviceId ? { catalogServices: { some: { catalogItemId: Number(serviceId) } } } : {})
  };

  try {
    const [profiles, total] = await prisma.$transaction([
      prisma.professionalProfile.findMany({
        where,
        include: {
          user: { select: { uuid: true, firstName: true, lastName: true, profilePictureUrl: true, city: true, state: true } },
          catalogServices: { include: { catalogItem: { include: { category: { select: { id: true, name: true } } } } } },
          portfolioImages: { orderBy: { sortOrder: 'asc' } }
        },
        orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.professionalProfile.count({ where })
    ]);

    res.json({
      data: profiles.map((profile) => ({
        id: bufferToUuid(profile.user.uuid),
        name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
        city: profile.user.city,
        state: profile.user.state,
        profilePictureUrl: profile.user.profilePictureUrl,
        headline: profile.headline,
        bio: profile.bio,
        rating: Number(profile.averageRating),
        reviewCount: profile.totalReviews,
        hourlyPrice: Number(profile.hourlyRate),
        dailyPrice: profile.dailyRate == null ? null : Number(profile.dailyRate),
        services: profile.catalogServices.map((item) => ({ id: item.catalogItem.id, name: item.catalogItem.name, category: item.catalogItem.category })),
        images: profile.portfolioImages.map((image) => image.url)
      })),
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    logger.error('searchProfessionals', err);
    res.status(500).json({ message: 'Não foi possível carregar os profissionais.' });
  }
};
