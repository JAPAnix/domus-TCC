import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { planAccountEvent } from '../utils/asaasEvents.js';
import { applyPaymentEvent } from './asaasPayments.js';
import { applyAccountEvent } from './payoutAccounts.js';
import { logger } from '../utils/logger.js';

/** Compara o token do cabeçalho `asaas-access-token` sem vazar nada pelo tempo de resposta. */
export function validWebhookToken(received, env = process.env) {
  const expected = env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const a = crypto.createHash('sha256').update(String(received)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Recebe um evento do Asaas. Regras da documentação: a entrega é "pelo menos uma vez", então o id do evento garante
 * que cada um seja processado uma só vez; respondemos 2xx rápido e, se o NOSSO processamento falhar, devolvemos 500
 * para o Asaas tentar de novo (o evento fica marcado como "failed" e é reprocessado na próxima tentativa).
 */
export async function handleAsaasWebhook({ token, body }, env = process.env) {
  if (!env.ASAAS_WEBHOOK_TOKEN) return { status: 503, body: { message: 'Webhook não configurado.' } };
  if (!validWebhookToken(token, env)) return { status: 401, body: { message: 'Token inválido.' } };
  const eventId = typeof body?.id === 'string' ? body.id.slice(0, 120) : null;
  const name = typeof body?.event === 'string' ? body.event.slice(0, 60) : null;
  if (!eventId || !name) return { status: 400, body: { message: 'Evento inválido.' } };

  const reference = String(body.payment?.id ?? body.account?.id ?? '').slice(0, 80) || null;
  try {
    await prisma.webhookEvent.create({ data: { provider: 'asaas', eventKey: eventId, status: 'processing', eventName: name, reference } });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const existing = await prisma.webhookEvent.findUnique({ where: { provider_eventKey: { provider: 'asaas', eventKey: eventId } } });
    if (existing?.status !== 'failed') return { status: 200, body: { ok: true, duplicate: true } };
    await prisma.webhookEvent.update({ where: { id: existing.id }, data: { status: 'processing', error: null } });
  }

  const finish = (status, error = null) => prisma.webhookEvent.updateMany({ where: { provider: 'asaas', eventKey: eventId }, data: { status, error: error?.slice(0, 300) ?? null } });
  try {
    let result;
    if (name.startsWith('ACCOUNT_STATUS_')) {
      const plan = planAccountEvent(body);
      result = plan.action === 'apply' && body.account?.id ? await applyAccountEvent(body.account.id, plan) : { ignored: plan.reason ?? 'sem_conta' };
    } else {
      result = await applyPaymentEvent(body);
    }
    const applied = result.applied || result.userId;
    await finish(applied ? 'done' : 'ignored', applied ? null : result.ignored ?? result.reason);
    return { status: 200, body: { ok: true } };
  } catch (error) {
    logger.error('asaas.webhook', error);
    await finish('failed', error.message);
    return { status: 500, body: { message: 'Erro ao processar.' } };
  }
}
