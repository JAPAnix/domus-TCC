import { prisma } from '../src/config/prisma.js';
import { normalizePhone } from '../src/validators/personalSettingsValidator.js';

// Dry run by default. Never prints personal data or changes ambiguous records.
try {
  const summary = await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({ select: { id: true, phoneNumber: true } });
    const seen = new Set();
    const changes = [];
    let skipped = 0;
    for (const user of users) {
      if (!user.phoneNumber) continue;
      let normalized;
      try { normalized = normalizePhone(user.phoneNumber); } catch { skipped++; continue; }
      if (seen.has(normalized)) throw new Error('Colisão detectada. Nenhum telefone foi alterado.');
      seen.add(normalized);
      if (normalized !== user.phoneNumber) changes.push({ id: user.id, old: user.phoneNumber, normalized });
    }
    if (process.argv.includes('--apply')) {
      for (const item of changes) await tx.user.updateMany({ where: { id: item.id, phoneNumber: item.old }, data: { phoneNumber: item.normalized, isPhoneVerified: false } });
    }
    return { candidates: changes.length, skipped, applied: process.argv.includes('--apply') };
  });
  console.log(JSON.stringify(summary));
} catch { console.error('Auditoria não concluída; nenhuma alteração foi aplicada.'); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
