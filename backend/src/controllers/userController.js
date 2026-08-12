import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

export const getUser = async (req, res) => {
  const { uuid } = req.params;

  try {
    const user = await prisma.user.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null },
      select: {
        uuid: true,
        firstName: true,
        lastName: true,
        profilePictureUrl: true,
        createdAt: true,
        professionalProfile: {
          select: {
            headline: true,
            averageRating: true,
            totalReviews: true,
            availabilityStatus: true,
            isVerified: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({ ...user, uuid: bufferToUuid(user.uuid) });
  } catch (err) {
    logger.error('getUser', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const updateUser = async (req, res) => {
  const { uuid } = req.params;
  const { first_name, last_name, phone_number, profile_picture_url, zip_code, street, number, complement, neighborhood, city, state } = req.body;
  const userId = BigInt(req.user.id);

  try {
    const user = await prisma.user.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (user.id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const updated = await prisma.user.update({
  where: { id: userId },
  data: {
    firstName: first_name,
    lastName: last_name,
    phoneNumber: phone_number,
    profilePictureUrl: profile_picture_url,
    zipCode: zip_code,
    street,
    number,
    complement,
    neighborhood,
    city,
    state
  },
  select: {
    uuid: true,
    firstName: true,
    lastName: true,
    email: true,
    phoneNumber: true,
    profilePictureUrl: true,
    zipCode: true,
    street: true,
    number: true,
    complement: true,
    neighborhood: true,
    city: true,
    state: true
  }
});

    res.json({ ...updated, uuid: bufferToUuid(updated.uuid) });
  } catch (err) {
    logger.error('updateUser', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Número de telefone já cadastrado' });
    }
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const deleteUser = async (req, res) => {
  const { uuid } = req.params;
  const userId = BigInt(req.user.id);

  try {
    const user = await prisma.user.findFirst({
      where: { uuid: uuidToBuffer(uuid), deletedAt: null }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (user.id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() }
    });

    res.status(204).send();
  } catch (err) {
    logger.error('deleteUser', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};