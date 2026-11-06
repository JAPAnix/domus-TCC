import { prisma } from '../config/prisma.js';
import { providerByName } from './payments/index.js';
import { asaas, asaasConfigured, asaasEnvironment } from './payments/asaasClient.js';
import { planAccountEvent, describeAccountDetail } from '../utils/asaasEvents.js';
import { decryptSecret, encryptSecret } from '../utils/secretBox.js';
import { feeConfig } from '../config/fees.js';
import { logger } from '../utils/logger.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

/** O Asaas está escolhido por PAYMENT_PROVIDER e com as chaves completas? É a "única variável" que liga tudo. */
export const asaasActive = (env = process.env) => env.PAYMENT_PROVIDER === 'asaas' && asaasConfigured(env);
export const escrowEnabled = (env = process.env) => env.ESCROW_ENABLED === 'true';

const CARD_NOTE = 'No cartão de crédito o repasse chega em 32 dias corridos depois do pagamento do cliente (uma parcela a cada 32 dias, se parcelado). O Pix cai na hora: é o meio mais rápido de receber.';

export function serializePayout(account) {
  const status = account?.status ?? 'not_started';
  return {
    enabled: asaasActive(),
    sandbox: asaasEnvironment() === 'sandbox',
    status,
    canReceive: status === 'approved',
    detail: describeAccountDetail(account?.statusDetail),
    rejectionReason: account?.rejectionReason ?? null,
    escrowEnabled: !!account?.escrowEnabled,
    cardNote: CARD_NOTE,
    nextStep: status === 'pending' ? 'Você vai receber um e-mail do Asaas para ativar a conta e enviar documentos e dados bancários. Depois disso, a análise leva algum tempo.' : null,
  };
}

export async function getPayoutState(userId) {
  return serializePayout(await prisma.payoutAccount.findUnique({ where: { userId } }));
}

/** Cria a subconta do profissional no gateway. A chave de API devolvida só aparece uma vez e é guardada cifrada. */
export async function createPayoutAccount(userId, form) {
  if (!asaasActive()) fail(503, 'O recebimento pela plataforma ainda não está disponível.');
  const existing = await prisma.payoutAccount.findUnique({ where: { userId } });
  if (existing?.accountId) fail(409, 'Você já cadastrou o seu recebimento.');
  // Antes de criar a conta, confere se dá para guardar a chave: se perder a chave, a conta ficaria sem uso.
  encryptSecret('teste');
  const created = await providerByName('asaas').createReceivingAccount(form, { escrowDays: escrowEnabled() ? feeConfig().escrowDays : undefined });
  const data = {
    provider: 'asaas', accountId: created.accountId, walletId: created.walletId, apiKeyEnc: encryptSecret(created.apiKey),
    status: 'pending', statusDetail: null, rejectionReason: null, escrowEnabled: created.escrowEnabled,
  };
  await prisma.payoutAccount.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return getPayoutState(userId);
}

/** Só no sandbox: aprova a subconta de teste do próprio usuário (em produção quem aprova é o Asaas). */
export async function approveInSandbox(userId, env = process.env) {
  if (asaasEnvironment(env) !== 'sandbox') fail(403, 'A aprovação de teste só existe no ambiente de testes (sandbox).');
  const account = await prisma.payoutAccount.findUnique({ where: { userId } });
  if (!account?.accountId) fail(404, 'Você ainda não cadastrou o seu recebimento.');
  // A documentação do Asaas cita duas rotas: a da conta principal (por id) e a da própria subconta (com a chave dela). Tenta as duas.
  try {
    await asaas.sandboxApproveAccount(account.accountId, { env });
  } catch (first) {
    if (!account.apiKeyEnc) throw first;
    try {
      await asaas.sandboxApproveOwnAccount(decryptSecret(account.apiKeyEnc), { env });
    } catch (second) {
      logger.info(`sandbox.approve falhou: rota por id HTTP ${first.details?.status ?? '?'}, rota da subconta HTTP ${second.details?.status ?? '?'}`);
      throw second;
    }
  }
  return refreshPayoutStatus(userId);
}

/** "Atualizar status": consulta o gateway agora (além do webhook). */
export async function refreshPayoutStatus(userId) {
  const account = await prisma.payoutAccount.findUnique({ where: { userId } });
  if (!account?.accountId || !account.apiKeyEnc) fail(404, 'Você ainda não cadastrou o seu recebimento.');
  const { status, detail } = await providerByName('asaas').getReceivingStatus(decryptSecret(account.apiKeyEnc));
  await prisma.payoutAccount.update({ where: { userId }, data: { status, statusDetail: detail, rejectionReason: status === 'rejected' ? planAccountEvent({ event: 'ACCOUNT_STATUS_X', accountStatus: detail }).rejectionReason : null } });
  return getPayoutState(userId);
}

/** Webhook de situação da conta: acha o profissional pelo id da subconta. */
export async function applyAccountEvent(accountId, plan) {
  const account = await prisma.payoutAccount.findFirst({ where: { accountId }, select: { userId: true } });
  if (!account) return { applied: false, reason: 'conta_desconhecida' };
  await prisma.payoutAccount.update({ where: { userId: account.userId }, data: { status: plan.status, statusDetail: plan.detail, rejectionReason: plan.rejectionReason } });
  return { applied: true, userId: account.userId, status: plan.status };
}

/** Recebimento pronto para cobrar? Devolve a carteira, a chave (decifrada só quando precisa) e se há garantia. */
export async function approvedReceiver(userId, { withKey = false } = {}) {
  const account = await prisma.payoutAccount.findUnique({ where: { userId } });
  if (!account || account.status !== 'approved' || !account.walletId) return null;
  let apiKey = null;
  if (withKey) {
    try { apiKey = decryptSecret(account.apiKeyEnc); } catch (error) { logger.error('payout.decrypt', error); return null; }
  }
  return { walletId: account.walletId, apiKey, escrowEnabled: account.escrowEnabled };
}

/** Painel do profissional: o que falta para receber pedidos pagos (null se não precisa avisar nada). */
export async function receivingWarning(userId) {
  if (!asaasActive()) return null;
  const account = await prisma.payoutAccount.findUnique({ where: { userId }, select: { status: true } });
  const status = account?.status ?? 'not_started';
  if (status === 'approved') return null;
  const messages = {
    not_started: 'Para os clientes poderem pagar pelo Dommos, cadastre como você recebe.',
    pending: 'O seu recebimento está em análise. Enquanto isso, os clientes ainda não conseguem pagar pelo Dommos.',
    rejected: 'O seu cadastro de recebimento foi recusado. Corrija os dados para os clientes poderem pagar pelo Dommos.',
  };
  return { status, message: messages[status] ?? messages.not_started };
}
