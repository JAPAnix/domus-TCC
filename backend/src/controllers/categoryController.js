import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

export const listCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: { children: true },
      orderBy: { name: 'asc' }
    });

    res.json(categories);
  } catch (err) {
    logger.error('listCategories', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};