import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

export const createProfile = async (req, res) => {
  const { headline, bio, hourly_rate, skills } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const existing = await prisma.professionalProfile.findUnique({
      where: { userId }
    });

    if (existing) {
      return res.status(409).json({ message: 'Perfil profissional já existe' });
    }

    const profile = await prisma.professionalProfile.create({
      data: {
        userId,
        headline,
        bio,
        hourlyRate: hourly_rate,
        skills: skills?.length
          ? {
              create: skills.map(s => ({
                skillId: s.skill_id,
                proficiencyLevel: s.proficiency_level ?? 'intermediate'
              }))
            }
          : undefined
      },
      include: {
        skills: {
          include: { skill: true }
        }
      }
    });

    const professionalRole = await prisma.role.findUnique({
      where: { name: 'professional' }
    });

    if (professionalRole) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId: professionalRole.id
          }
        },
        update: {},
        create: {
          userId,
          roleId: professionalRole.id
        }
      });
    }

    res.status(201).json(profile);
  } catch (err) {
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
        professionalProfile: {
          include: {
            skills: {
              include: { skill: true }
            }
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
      ...user.professionalProfile
    });
  } catch (err) {
    logger.error('getProfile', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateProfile = async (req, res) => {
  const { uuid } = req.params;
  const { headline, bio, hourly_rate, skills } = req.body;
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
      data: {
        headline,
        bio,
        hourlyRate: hourly_rate,
        ...(skills && {
          skills: {
            deleteMany: {},
            create: skills.map(s => ({
              skillId: s.skill_id,
              proficiencyLevel: s.proficiency_level ?? 'intermediate'
            }))
          }
        })
      },
      include: {
        skills: {
          include: { skill: true }
        }
      }
    });

    res.json(profile);
  } catch (err) {
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