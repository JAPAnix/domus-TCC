import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { generateUuid, bufferToUuid } from '../utils/uuid.js';

export const register = async (req, res) => {
  const { first_name, last_name, email, password, phone_number } = req.body;

  try {
    const userExists = await prisma.users.findUnique({
      where: { email }
    });

    if (userExists) {
      return res.status(409).json({ message: 'E-mail já cadastrado' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        uuid: generateUuid(),
        first_name,
        last_name,
        email,
        password_hash,
        phone_number
      }
    });

    res.status(201).json({
      uuid: bufferToUuid(user.uuid),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.users.findUnique({
      where: { email },
      include: {
        user_roles: {
          include: {
            roles: true
          }
        }
      }
    });

    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    if (user.deleted_at) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const roles = user.user_roles.map(ur => ur.roles.name);

    const token = jwt.sign(
      {
        id: user.id,
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
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        roles
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const me = async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      include: {
        user_roles: {
          include: { roles: true }
        },
        professional_profiles: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
      uuid: bufferToUuid(user.uuid),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number,
      profile_picture_url: user.profile_picture_url,
      is_email_verified: user.is_email_verified,
      roles: user.user_roles.map(ur => ur.roles.name),
      has_professional_profile: !!user.professional_profiles
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};