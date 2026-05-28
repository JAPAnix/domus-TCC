import prisma from '../config/database.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';

export const createProfile = async (req, res) => {
  const { headline, bio, hourly_rate, skills } = req.body;
  const userId = req.user.id;

  try {
    // Verifica se já existe perfil profissional
    const existing = await prisma.professional_profiles.findUnique({
      where: { user_id: userId }
    });

    if (existing) {
      return res.status(409).json({ message: 'Perfil profissional já existe' });
    }

    const profile = await prisma.professional_profiles.create({
      data: {
        user_id: userId,
        headline,
        bio,
        hourly_rate,
        // Cria as skills do perfil se fornecidas
        profile_skills: skills?.length
          ? {
              create: skills.map(skillId => ({
                skill_id: skillId,
                proficiency_level: 'intermediate'
              }))
            }
          : undefined
      },
      include: {
        profile_skills: {
          include: { skill: true }
        }
      }
    });

    // Adiciona role 'professional' ao usuário
    const professionalRole = await prisma.roles.findUnique({
      where: { name: 'professional' }
    });

    await prisma.user_roles.upsert({
      where: {
        user_id_role_id: {
          user_id: userId,
          role_id: professionalRole.id
        }
      },
      update: {},
      create: {
        user_id: userId,
        role_id: professionalRole.id
      }
    });

    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const getProfile = async (req, res) => {
  const { uuid } = req.params;

  try {
    const user = await prisma.users.findUnique({
      where: { uuid: uuidToBuffer(uuid) },
      select: {
        uuid: true,
        first_name: true,
        last_name: true,
        profile_picture_url: true,
        professional_profiles: {
          include: {
            profile_skills: {
              include: { skill: true }
            }
          }
        }
      }
    });

    if (!user || !user.professional_profiles) {
      return res.status(404).json({ message: 'Perfil profissional não encontrado' });
    }

    res.json({
      uuid: bufferToUuid(user.uuid),
      first_name: user.first_name,
      last_name: user.last_name,
      profile_picture_url: user.profile_picture_url,
      ...user.professional_profiles
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateProfile = async (req, res) => {
  const { uuid } = req.params;
  const { headline, bio, hourly_rate, skills } = req.body;
  const userId = req.user.id;

  try {
    const user = await prisma.users.findUnique({
      where: { uuid: uuidToBuffer(uuid) }
    });

    if (!user || user.id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const profile = await prisma.professional_profiles.update({
      where: { user_id: userId },
      data: {
        headline,
        bio,
        hourly_rate,
        // Substitui todas as skills se fornecidas
        ...(skills && {
          profile_skills: {
            deleteMany: {},
            create: skills.map(({ skill_id, proficiency_level }) => ({
              skill_id,
              proficiency_level
            }))
          }
        })
      },
      include: {
        profile_skills: {
          include: { skill: true }
        }
      }
    });

    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateAvailability = async (req, res) => {
  const { uuid } = req.params;
  const { availability_status } = req.body;
  const userId = req.user.id;

  const validStatuses = ['available', 'busy', 'offline'];

  try {
    if (!validStatuses.includes(availability_status)) {
      return res.status(400).json({
        message: `Status inválido. Use: ${validStatuses.join(', ')}`
      });
    }

    const user = await prisma.users.findUnique({
      where: { uuid: uuidToBuffer(uuid) }
    });

    if (!user || user.id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const profile = await prisma.professional_profiles.update({
      where: { user_id: userId },
      data: { availability_status }
    });

    res.json({ availability_status: profile.availability_status });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};