import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

export const listServiceCatalog = async (req, res) => {
  try {
    const items = await prisma.serviceCatalogItem.findMany({
      where: { active: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
    });

    res.json(items);
  } catch (err) {
    logger.error('listServiceCatalog', err);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};
