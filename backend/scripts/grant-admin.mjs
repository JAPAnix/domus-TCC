// Dá o papel de administrador a uma conta existente.
// Uso (em backend/): node --env-file=.env scripts/grant-admin.mjs e-mail@exemplo.com [--remove]
import { prisma } from '../src/config/prisma.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Informe o e-mail da conta. Ex.: node --env-file=.env scripts/grant-admin.mjs voce@exemplo.com');
  process.exit(1);
}

const user = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true, firstName: true } });
if (!user) {
  console.error('Nenhuma conta ativa com esse e-mail.');
  process.exit(1);
}
const role = await prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin' } });
if (process.argv.includes('--remove')) {
  await prisma.userRole.deleteMany({ where: { userId: user.id, roleId: role.id } });
  console.log(`Papel de administrador removido de ${email}.`);
} else {
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  console.log(`${email} agora é administrador. Saia e entre de novo na conta.`);
}
await prisma.$disconnect();
