import { asaasActive } from './payoutAccounts.js';
import { autoConfirmDue, reconcilePending } from './asaasPayments.js';
import { logger } from '../utils/logger.js';

let timer = null;

/**
 * Rotinas do pagamento pela plataforma, a cada 5 minutos: conferir no gateway pagamentos pendentes (webhook perdido)
 * e liberar o valor dos serviços cujo prazo de confirmação acabou. Só roda com PAYMENT_PROVIDER=asaas.
 */
export function startAsaasJobs(intervalMs = 5 * 60 * 1000) {
  if (timer || !asaasActive()) return;
  const run = () => Promise.all([reconcilePending(), autoConfirmDue()]).catch((error) => logger.error('asaas.jobs', error));
  timer = setInterval(run, intervalMs);
  timer.unref();
  setTimeout(run, 30 * 1000).unref();
}
