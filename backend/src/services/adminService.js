import { bufferToUuid } from '../utils/uuid.js';
import { ALERT_INFO, SEVERITY_ORDER, ignoredText } from '../utils/adminAlerts.js';
import { ALERT_TYPES } from '../utils/asaasEvents.js';
import { formatCents } from '../utils/money.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const nameOf = (person) => person?.preferredName?.trim() || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Usuário';
const STALE_DAYS = 3;
const DAY = 86400000;

// ---- Auditoria: quem decidiu o quê e quando --------------------------------------------------------------------------
export const writeAudit = (db, { adminId, action, targetType, targetId, detail }) =>
  db.adminAuditLog.create({ data: { adminId, action, targetType, targetId: String(targetId), detail: detail ? String(detail).slice(0, 500) : null } });

const AUDIT_LABELS = {
  'dispute.release': 'Manteve o pagamento ao profissional', 'dispute.refund': 'Reembolsou o cliente (total)', 'dispute.partial': 'Reembolsou o cliente (parcial)',
  'alert.resolve': 'Marcou um alerta como resolvido',
};
export async function listAudit(db, { limit = 100 } = {}) {
  const rows = await db.adminAuditLog.findMany({ orderBy: { id: 'desc' }, take: Math.min(200, limit) });
  const ids = [...new Set(rows.map((row) => row.adminId))];
  const admins = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, preferredName: true } }) : [];
  const names = new Map(admins.map((admin) => [admin.id.toString(), nameOf(admin)]));
  return rows.map((row) => ({ id: row.id.toString(), action: row.action, actionLabel: AUDIT_LABELS[row.action] ?? row.action, admin: names.get(row.adminId.toString()) ?? 'Administrador', targetType: row.targetType, targetId: row.targetId, detail: row.detail, createdAt: row.createdAt }));
}

// ---- Alertas ----------------------------------------------------------------------------------------------------------
function present(kind, extra) {
  const info = ALERT_INFO[kind] ?? { title: kind, severity: 'medium', meaning: 'Alerta sem descrição.', why: '', action: '', actionLabel: null };
  return { kind, severity: info.severity, title: info.title, meaning: info.meaning, why: info.why, action: info.action, actionLabel: info.actionLabel, ...extra };
}

/**
 * Alertas do administrador. Os guardados (chargeback, repasse e reembolso com falha...) ficam abertos até alguém marcar como
 * resolvido, com uma nota. Os calculados na hora (pagamento parado, aviso do gateway, profissional sem conta) somem sozinhos
 * quando o problema acaba, por isso não têm botão de resolver.
 */
export async function listAlerts(db, { status = 'open', now = new Date(), asaasEnabled = false } = {}) {
  const resolvedFilter = status === 'open' ? { resolvedAt: null } : status === 'resolved' ? { resolvedAt: { not: null } } : {};
  const stored = await db.paymentEvent.findMany({
    where: { type: { in: ALERT_TYPES }, ...resolvedFilter }, orderBy: { id: 'desc' }, take: 100,
    include: { payment: { include: { order: { select: { uuid: true, titleSnapshot: true } } } } },
  });
  const alerts = stored.map((event) => present(event.type.slice(6), {
    id: String(event.id), detail: event.detail, createdAt: event.createdAt, resolvedAt: event.resolvedAt, resolutionNote: event.resolutionNote, resolvable: !event.resolvedAt,
    paymentUuid: bufferToUuid(event.payment.uuid), orderUuid: bufferToUuid(event.payment.order.uuid), service: event.payment.order.titleSnapshot,
  }));

  if (status !== 'resolved') {
    const stale = await db.payment.findMany({
      where: { provider: 'asaas', status: 'pending', createdAt: { lt: new Date(now.getTime() - STALE_DAYS * DAY) } }, orderBy: { id: 'asc' }, take: 20,
      include: { order: { select: { uuid: true, titleSnapshot: true } } },
    });
    for (const payment of stale) alerts.push(present('stale_pending', { id: `c:stale:${payment.id}`, detail: `Cobrança de ${formatCents(payment.amountCents ?? 0)} gerada há ${Math.floor((now - payment.createdAt) / DAY)} dias.`, createdAt: payment.createdAt, resolvable: false, paymentUuid: bufferToUuid(payment.uuid), orderUuid: bufferToUuid(payment.order.uuid), service: payment.order.titleSnapshot }));

    const failed = await db.webhookEvent.findMany({ where: { provider: 'asaas', status: 'failed' }, orderBy: { id: 'desc' }, take: 20 });
    for (const event of failed) alerts.push(present('webhook_failed', { id: `c:webhook:${event.id}`, detail: `${event.eventName} (${event.reference ?? 'sem referência'}): ${event.error ?? 'erro desconhecido'}`, createdAt: event.processedAt ?? event.createdAt, resolvable: false }));

    if (asaasEnabled) {
      const pros = await db.user.findMany({
        where: { deletedAt: null, professionalProfile: { isNot: null }, listings: { some: { status: 'published', deletedAt: null } }, OR: [{ payoutAccount: null }, { payoutAccount: { is: { status: { not: 'approved' } } } }] },
        select: { id: true, firstName: true, lastName: true, preferredName: true, createdAt: true, payoutAccount: { select: { status: true } } }, orderBy: { id: 'asc' }, take: 20,
      });
      for (const pro of pros) alerts.push(present('pro_without_account', { id: `c:pro:${pro.id}`, detail: `${nameOf(pro)}: conta de recebimento ${({ pending: 'em análise', rejected: 'recusada' })[pro.payoutAccount?.status] ?? 'não cadastrada'}.`, createdAt: pro.createdAt, resolvable: false }));
    }
  }
  return alerts.sort((a, b) => (a.resolvedAt ? 1 : 0) - (b.resolvedAt ? 1 : 0) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || new Date(b.createdAt) - new Date(a.createdAt));
}

/** Marca um alerta guardado como resolvido, com nota, e registra quem fez. */
export async function resolveAlert(db, adminId, id, note) {
  if (!/^\d{1,18}$/.test(String(id))) fail(400, 'Este alerta some sozinho quando o problema for resolvido. Não há o que marcar.');
  const text = String(note ?? '').trim();
  if (text.length < 5 || text.length > 500) fail(400, 'Escreva o que foi feito para resolver, de 5 a 500 caracteres.');
  const event = await db.paymentEvent.findUnique({ where: { id: BigInt(id) } });
  if (!event || !ALERT_TYPES.includes(event.type)) fail(404, 'Alerta não encontrado.');
  if (event.resolvedAt) fail(409, 'Este alerta já foi resolvido.');
  await db.paymentEvent.update({ where: { id: event.id }, data: { resolvedAt: new Date(), resolvedById: adminId, resolutionNote: text } });
  await writeAudit(db, { adminId, action: 'alert.resolve', targetType: 'alert', targetId: id, detail: `${event.type.slice(6)}: ${text}` });
  return { resolved: true };
}

// ---- Transações e comissões -------------------------------------------------------------------------------------------
const startOfDay = (value) => { const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? new Date(`${value}T00:00:00.000Z`) : null; return date && !Number.isNaN(date.getTime()) ? date : null; };

/** Totais e linhas de um período. Comissão = comissão do profissional + taxa de serviço do cliente, só do que não foi estornado. */
export async function transactionsReport(db, { from, to } = {}) {
  const start = startOfDay(from), end = startOfDay(to);
  const payments = await db.payment.findMany({
    where: { provider: 'asaas', ...((start || end) && { createdAt: { ...(start && { gte: start }), ...(end && { lt: new Date(end.getTime() + DAY) }) } }) },
    orderBy: { id: 'desc' }, take: 2000,
    include: { order: { select: { uuid: true, titleSnapshot: true } }, client: { select: { firstName: true, lastName: true, preferredName: true } }, professional: { select: { firstName: true, lastName: true, preferredName: true } } },
  });
  const totals = { count: payments.length, paidCents: 0, commissionCents: 0, refundedCents: 0, byStatus: {} };
  const rows = payments.map((payment) => {
    totals.byStatus[payment.status] = (totals.byStatus[payment.status] ?? 0) + 1;
    const platform = (payment.commissionCents ?? 0) + (payment.clientFeeCents ?? 0);
    if (['confirmed', 'disputed', 'chargeback'].includes(payment.status)) { totals.paidCents += payment.amountCents ?? 0; totals.commissionCents += Math.max(0, platform - (payment.refundedCents ? Math.round(platform * payment.refundedCents / (payment.amountCents || 1)) : 0)); }
    totals.refundedCents += payment.refundedCents ?? 0;
    return {
      uuid: bufferToUuid(payment.uuid), orderUuid: bufferToUuid(payment.order.uuid), service: payment.order.titleSnapshot, client: nameOf(payment.client), professional: nameOf(payment.professional),
      method: payment.method, status: payment.status, payoutStatus: payment.payoutStatus, amountCents: payment.amountCents ?? 0, commissionCents: platform, refundedCents: payment.refundedCents ?? 0, createdAt: payment.createdAt,
    };
  });
  return { totals, rows };
}

const csvCell = (value) => { const text = String(value ?? ''); return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const money = (cents) => ((cents ?? 0) / 100).toFixed(2).replace('.', ',');
const METHODS = { pix: 'Pix', credit_card: 'Cartão de crédito', boleto: 'Boleto' };
const STATUSES = { pending: 'Aguardando pagamento', confirmed: 'Pago', refunded: 'Estornado', disputed: 'Em reclamação', chargeback: 'Contestado', cancelled: 'Cancelado', expired: 'Expirado', refused: 'Recusado' };

/** CSV para Excel brasileiro: ponto e vírgula, decimal com vírgula e BOM para os acentos. */
export function transactionsCsv(rows) {
  const header = ['Data', 'Serviço', 'Cliente', 'Profissional', 'Meio', 'Situação', 'Valor pago (R$)', 'Comissão do Dommos (R$)', 'Estornado (R$)'];
  const lines = rows.map((row) => [new Date(row.createdAt).toISOString().slice(0, 10), row.service, row.client, row.professional, METHODS[row.method] ?? row.method, STATUSES[row.status] ?? row.status, money(row.amountCents), money(row.commissionCents), money(row.refundedCents)]);
  return String.fromCharCode(0xfeff) + [header, ...lines].map((line) => line.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export { ignoredText };
