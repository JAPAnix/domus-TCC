import { prisma } from '../src/config/prisma.js';
import { catalog } from './catalog.js';

// Só o catálogo de categorias e serviços (sem contas nem dados de demonstração). Usado pelos testes E2E.
function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function seed() {
  let total = 0;

  const [clientRole, professionalRole] = await Promise.all(['client', 'professional'].map((name) => prisma.role.upsert({
    where: { name }, update: {}, create: { name }
  })));
  const [users, profiles] = await Promise.all([
    prisma.user.findMany({ where: { deletedAt: null }, select: { id: true } }),
    prisma.professionalProfile.findMany({ select: { userId: true } })
  ]);
  await prisma.userRole.createMany({ data: users.map((user) => ({ userId: user.id, roleId: clientRole.id })), skipDuplicates: true });
  await prisma.userRole.createMany({ data: profiles.map((profile) => ({ userId: profile.userId, roleId: professionalRole.id })), skipDuplicates: true });

  for (const [categoryName, serviceNames] of Object.entries(catalog)) {
    const category = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });

    for (const name of serviceNames) {
      await prisma.serviceCatalogItem.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug: slugify(name) } },
        update: { active: true },
        create: { categoryId: category.id, name, slug: slugify(name), active: true },
      });
      total += 1;
    }
  }

  console.log(`Catálogo sincronizado: ${Object.keys(catalog).length} categorias e ${total} serviços.`);
}

seed()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
