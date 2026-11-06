import { logger } from '../utils/logger.js';
import { handleAsaasWebhook } from '../services/asaasWebhook.js';
import { createPayoutAccount, getPayoutState, refreshPayoutStatus, receivingWarning } from '../services/payoutAccounts.js';
import { confirmService, openDispute, resolveDispute } from '../services/asaasPayments.js';
import { adminAlerts, adminDisputes, adminPayments, adminSummary, adminWebhookEvents, earningsCsv, earningsFor } from '../services/asaasReports.js';

const me = (req) => BigInt(req.user.id);

function fail(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  logger.error(label, err);
  return res.status(500).json({ message: 'Não foi possível concluir a operação. Tente novamente.' });
}
const handler = (label, work, status = 200) => async (req, res) => {
  try { res.status(status).set('Cache-Control', 'no-store').json(await work(req)); } catch (err) { fail(res, err, label); }
};

/** Webhook do Asaas: público, protegido pelo token do cabeçalho `asaas-access-token`. */
export async function asaasWebhook(req, res) {
  try {
    const result = await handleAsaasWebhook({ token: req.get('asaas-access-token'), body: req.body });
    res.status(result.status).json(result.body);
  } catch (err) { fail(res, err, 'asaas.webhook'); }
}

// ---- Conta de recebimento ("Como recebo") ------------------------------------------------------------------------
export const receivingAccount = handler('asaas.receivingAccount', async (req) => ({ ...(await getPayoutState(me(req))), warning: await receivingWarning(me(req)) }));
export const createReceivingAccount = handler('asaas.createReceivingAccount', (req) => {
  const b = req.body;
  return createPayoutAccount(me(req), {
    name: b.name, email: b.email, cpfCnpj: b.cpf_cnpj, mobilePhone: b.mobile_phone, incomeValue: b.income_value, address: b.address, addressNumber: b.address_number,
    province: b.province, postalCode: b.postal_code, complement: b.complement, birthDate: b.birth_date, companyType: b.company_type,
  });
}, 201);
export const refreshReceivingAccount = handler('asaas.refreshReceivingAccount', (req) => refreshPayoutStatus(me(req)));

// ---- Ações do cliente sobre um pagamento --------------------------------------------------------------------------
export const confirmServiceAction = handler('asaas.confirmService', (req) => confirmService(req.params.uuid, me(req)));
export const disputeAction = handler('asaas.dispute', (req) => openDispute(req.params.uuid, me(req), req.body.reason), 201);

// ---- Ganhos do profissional -----------------------------------------------------------------------------------------
export async function earnings(req, res) {
  try {
    const result = await earningsFor(me(req), { from: req.query.de, to: req.query.ate });
    if (req.query.formato === 'csv') {
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ganhos-dommos.csv"', 'Cache-Control': 'no-store' });
      return res.send(earningsCsv(result.data));
    }
    return res.set('Cache-Control', 'no-store').json(result);
  } catch (err) { return fail(res, err, 'asaas.earnings'); }
}

// ---- Administrador --------------------------------------------------------------------------------------------------------
export const adminOverview = handler('admin.summary', () => adminSummary());
export const adminPaymentList = handler('admin.payments', (req) => adminPayments({ status: req.query.status, page: Math.max(1, Number(req.query.page) || 1) }));
export const adminDisputeList = handler('admin.disputes', (req) => adminDisputes(req.query.status === 'all' ? 'all' : req.query.status === 'resolved_release' || req.query.status === 'resolved_refund' ? req.query.status : 'open'));
export const adminResolve = handler('admin.resolve', (req) => resolveDispute(me(req), req.params.id, req.body.decision, req.body.note));
export const adminAlertList = handler('admin.alerts', () => adminAlerts());
export const adminWebhookList = handler('admin.webhooks', (req) => adminWebhookEvents(['done', 'ignored', 'failed', 'processing'].includes(req.query.status) ? req.query.status : undefined));
