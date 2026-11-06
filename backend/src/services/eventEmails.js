import { prisma } from '../config/prisma.js';
import { resolvePreferences } from '../utils/notificationPrefs.js';
import { sendPlainEmail, smtpConfigured } from './emailService.js';
import { logger } from '../utils/logger.js';

const SUBJECTS = {
  proposal_received: 'Você recebeu uma nova proposta',
  proposal_accepted: 'Sua proposta foi aceita',
  service_completed: 'Serviço concluído',
  review_received: 'Você recebeu uma avaliação',
  order_received: 'Você recebeu um novo pedido',
  order_update: 'Atualização do seu pedido',
  payment_update: 'Atualização de pagamento',
  message_new: 'Você recebeu uma mensagem',
};

/** Envia e-mails de eventos depois que a transação já foi confirmada. Falhas nunca afetam o fluxo principal. */
export async function dispatchEventEmails(jobs) {
  if (!smtpConfigured()) return;
  const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
  for (const job of jobs) {
    try {
      const user = await prisma.user.findFirst({
        where: { id: job.userId, deletedAt: null, deactivatedAt: null },
        select: { email: true, firstName: true, settings: { select: { notificationPreferences: true } } },
      });
      if (!user) continue;
      if (!resolvePreferences(user.settings?.notificationPreferences)[job.type]?.email) continue;
      await sendPlainEmail({
        to: user.email,
        subject: `${SUBJECTS[job.type] ?? 'Novidade'} · Dommos`,
        text: `Olá, ${user.firstName}!\n\n${job.message}\n\nAbra no Dommos: ${origin}${job.href}\n\nVocê escolhe quais e-mails receber em Configurações da conta > Notificações.`,
      });
    } catch (err) {
      logger.error('dispatchEventEmails', err);
    }
  }
}
