import prisma from '../config/database.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';

export const getUser = async (req, res) => {
  const { uuid } = req.params;

  try {
    const user = await prisma.users.findFirst({
      where: { uuid: uuidToBuffer(uuid), deleted_at: null },
      select: {
        uuid: true,
        first_name: true,
        last_name: true,
        profile_picture_url: true,
        created_at: true,
        professional_profiles: {
          select: {
            headline: true,
            average_rating: true,
            total_reviews: true,
            availability_status: true,
            is_verified: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
      ...user,
      uuid: bufferToUuid(user.uuid)
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateUser = async (req, res) => {
  const { uuid } = req.params;
  const { first_name, last_name, phone_number, profile_picture_url } = req.body;
  const userId = req.user.id;

  try {
    const user = await prisma.users.findFirst({
      where: { uuid: uuidToBuffer(uuid), deleted_at: null }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (user.id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const updated = await prisma.users.update({
      where: { id: userId },
      data: { first_name, last_name, phone_number, profile_picture_url },
      select: {
        uuid: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        profile_picture_url: true
      }
    });

    res.json({
      ...updated,
      uuid: bufferToUuid(updated.uuid)
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Número de telefone já cadastrado' });
    }
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const deleteUser = async (req, res) => {
  const { uuid } = req.params;
  const userId = req.user.id;

  try {
    const user = await prisma.users.findFirst({
      where: { uuid: uuidToBuffer(uuid), deleted_at: null }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (user.id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    await prisma.users.update({
      where: { id: userId },
      data: { deleted_at: new Date() }
    });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};