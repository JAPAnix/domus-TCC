import { prisma } from '../config/prisma.js';

export const listSkills = async (req, res) => {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(skills);
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};