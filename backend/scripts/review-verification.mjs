// Análise manual da verificação de um profissional (ainda não há painel administrativo).
//
//   node --env-file=.env scripts/review-verification.mjs list
//   node --env-file=.env scripts/review-verification.mjs approve profissional@email.com
//   node --env-file=.env scripts/review-verification.mjs reject  profissional@email.com
//
// Aprovar liga o selo "Verificado" no perfil; recusar desliga. O documento informado fica em user_settings.
import { prisma } from '../src/config/prisma.js';

const [command, email] = process.argv.slice(2);

async function main() {
  if (command === 'list') {
    const rows = await prisma.professionalVerification.findMany({ where: { status: 'pending' }, orderBy: { submittedAt: 'asc' }, include: { user: { select: { email: true } } } });
    if (!rows.length) return console.log('Nenhuma verificação pendente.');
    for (const row of rows) console.log(`${row.user.email}\t${row.legalName}\t${row.documentType.toUpperCase()}\tenviada em ${row.submittedAt.toISOString()}`);
    return undefined;
  }
  if (!['approve', 'reject'].includes(command) || !email) {
    console.error('Uso: review-verification.mjs list | approve <email> | reject <email>');
    process.exitCode = 1;
    return undefined;
  }
  const user = await prisma.user.findFirst({ where: { email: email.trim().toLowerCase(), deletedAt: null }, select: { id: true } });
  const verification = user && await prisma.professionalVerification.findUnique({ where: { userId: user.id } });
  if (!verification) {
    console.error('Nenhuma verificação encontrada para este e-mail.');
    process.exitCode = 1;
    return undefined;
  }
  const approved = command === 'approve';
  await prisma.$transaction([
    prisma.professionalVerification.update({ where: { userId: user.id }, data: { status: approved ? 'approved' : 'rejected', reviewedAt: new Date() } }),
    prisma.professionalProfile.updateMany({ where: { userId: user.id }, data: { isVerified: approved } }),
  ]);
  console.log(approved ? 'Verificação aprovada: selo "Verificado" ativado.' : 'Verificação recusada: selo desativado.');
  return undefined;
}

await main().finally(() => prisma.$disconnect());
