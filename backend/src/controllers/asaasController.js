import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { handleAsaasWebhook } from '../services/asaasWebhook.js';
import { approveInSandbox, asaasActive, createPayoutAccount, getPayoutState, refreshPayoutStatus, receivingWarning } from '../services/payoutAccounts.js';
import { listAlerts, listAudit, resolveAlert, transactionsCsv, transactionsReport } from '../services/adminService.js';
import { confirmService, openDispute, resolveDispute } from '../services/asaasPayments.js';
import { adminDisputes, adminPayments, adminSummary, adminWebhookEvents, earningsCsv, earningsFor } from '../services/asaasReports.js';

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
export const sandboxApproveAccount = handler('asaas.sandboxApprove', (req) => approveInSandbox(me(req)));

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
export const adminDisputeList = handler('admin.disputes', (req) => adminDisputes(['all', 'resolved_release', 'resolved_refund', 'resolved_partial'].includes(req.query.status) ? req.query.status : 'open'));
export const adminResolve = handler('admin.resolve', (req) => resolveDispute(me(req), req.params.id, { decision: req.body.decision, note: req.body.note, refundCents: req.body.refund_cents }));
export const adminAlertList = handler('admin.alerts', (req) => listAlerts(prisma, { status: ['open', 'resolved', 'all'].includes(req.query.status) ? req.query.status : 'open', asaasEnabled: asaasActive() }));
export const adminAlertResolve = handler('admin.alertResolve', (req) => resolveAlert(prisma, me(req), req.params.id, req.body.note));
export const adminAuditList = handler('admin.audit', () => listAudit(prisma));
export async function adminTransactions(req, res) {
  try {
    const report = await transactionsReport(prisma, { from: req.query.de, to: req.query.ate });
    if (req.query.formato === 'csv') {
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="transacoes-dommos.csv"', 'Cache-Control': 'no-store' });
      return res.send(transactionsCsv(report.rows));
    }
    return res.set('Cache-Control', 'no-store').json(report);
  } catch (err) { return fail(res, err, 'admin.transactions'); }
}
export const adminWebhookList = handler('admin.webhooks', (req) => adminWebhookEvents(['done', 'ignored', 'failed', 'processing'].includes(req.query.status) ? req.query.status : undefined));
