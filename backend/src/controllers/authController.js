import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { generateUuid, bufferToUuid } from '../utils/uuid.js';

export const register = async (req, res) => {
  const { first_name, last_name, email, password, phone_number } = req.body;

  try {
    const userExists = await prisma.user.findUnique({
      where: { email }
    });

    if (userExists) {
      return res.status(409).json({ message: 'E-mail já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        uuid: generateUuid(),
        firstName: first_name,
        lastName: last_name,
        email,
        passwordHash,
        phoneNumber: phone_number
      }
    });

    res.status(201).json({
      uuid: bufferToUuid(user.uuid),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    });
  } catch (err) {
    logger.error('register', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    if (user.deletedAt) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const roles = user.roles.map(ur => ur.role.name);

    const token = jwt.sign(
      {
        id: user.id.toString(),
        uuid: bufferToUuid(user.uuid),
        email: user.email,
        roles
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        uuid: bufferToUuid(user.uuid),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles
      }
    });
  } catch (err) {
    logger.error('login', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(req.user.id) },
      include: {
        roles: {
          include: { role: true }
        },
        professionalProfile: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
      uuid: bufferToUuid(user.uuid),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePictureUrl: user.profilePictureUrl,
      isEmailVerified: user.isEmailVerified,
      roles: user.roles.map(ur => ur.role.name),
      hasProfessionalProfile: !!user.professionalProfile
    });
  } catch (err) {
    logger.error('me', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};