import prisma from '../config/database.js';

export const listCategories = async (req, res) => {
  try {
    const categories = await prisma.categories.findMany({
      where: { parent_id: null }, // busca apenas categorias raiz
      include: {
        other_categories: true   // inclui subcategorias
      },
      orderBy: { name: 'asc' }
    });

    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};