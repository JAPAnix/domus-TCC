import { prisma } from '../config/prisma.js';
import { formatCents } from '../utils/money.js';
import { ALERT_TYPES } from '../utils/asaasEvents.js';
import { daysOpen } from '../utils/disputeRules.js';
import { ignoredText } from '../utils/adminAlerts.js';
import { bufferToUuid } from '../utils/uuid.js';

const nameOf = (user) => user.preferredName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ');
const personSelect = { uuid: true, firstName: true, lastName: true, preferredName: true };
const RELEVANT = ['confirmed', 'refunded', 'disputed', 'chargeback'];

/** Valor que o profissional absorveu da taxa do gateway: parte dele sem taxa menos o que de fato recebe. */
const gatewayShare = (payment) => Math.max(0, (payment.amountCents - payment.clientFeeCents - payment.commissionCents) - payment.proShareCents);

const dayStart = (text) => (/^\d{4}-\d{2}-\d{2}$/.test(text ?? '') ? new Date(`${text}T00:00:00.000Z`) : null);

/** Ganhos do profissional: linhas e totais (a liberar, liberado, estornado e comissão descontada). */
export async function earningsFor(userId, { from, to } = {}) {
  const start = dayStart(from);
  const end = dayStart(to);
  const rows = await prisma.payment.findMany({
    where: { professionalId: userId, provider: 'asaas', status: { in: RELEVANT }, ...((start || end) && { createdAt: { ...(start && { gte: start }), ...(end && { lt: new Date(end.getTime() + 86400000) }) } }) },
    orderBy: { id: 'desc' }, take: 500,
    include: { order: { select: { uuid: true, titleSnapshot: true } }, client: { select: personSelect } },
  });
  const totals = { toReleaseCents: 0, releasedCents: 0, refundedCents: 0, commissionCents: 0 };
  const data = rows.map((payment) => {
    const net = payment.proShareCents ?? 0;
    if (payment.status === 'refunded') totals.refundedCents += payment.amountCents;
    else if (payment.payoutStatus === 'released') totals.releasedCents += net;
    else if (payment.payoutStatus === 'held') totals.toReleaseCents += net;
    if (payment.status !== 'refunded') totals.commissionCents += payment.commissionCents;
    return {
      uuid: bufferToUuid(payment.uuid), orderUuid: bufferToUuid(payment.order.uuid), service: payment.order.titleSnapshot, client: nameOf(payment.client),
      method: payment.method, status: payment.status, payoutStatus: payment.payoutStatus, createdAt: payment.createdAt, confirmedAt: payment.confirmedAt,
      paidCents: payment.amountCents - payment.clientFeeCents, commissionCents: payment.commissionCents, gatewayFeeCents: gatewayShare(payment), netCents: net,
      installments: payment.installments, receiptNumber: payment.receiptNumber,
    };
  });
  return { data, totals };
}

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const money = (cents) => (cents / 100).toFixed(2).replace('.', ',');
const METHOD = { pix: 'Pix', credit_card: 'Cartão de crédito', boleto: 'Boleto' };
const STATUS = { confirmed: 'Pago', refunded: 'Estornado', disputed: 'Em análise', chargeback: 'Contestado' };
const PAYOUT = { none: '', held: 'A liberar', released: 'Liberado', refunded: 'Estornado' };

/** CSV para Excel brasileiro: separador ponto e vírgula, decimal com vírgula e BOM para os acentos. */
export function earningsCsv(rows) {
  const header = ['Data', 'Serviço', 'Cliente', 'Meio', 'Parcelas', 'Situação', 'Repasse', 'Pago pelo cliente (R$)', 'Comissão (R$)', 'Taxa do gateway (R$)', 'Líquido (R$)', 'Recibo'];
  const lines = rows.map((row) => [
    new Date(row.confirmedAt ?? row.createdAt).toISOString().slice(0, 10), row.service, row.client, METHOD[row.method] ?? row.method, row.installments ?? 1,
    STATUS[row.status] ?? row.status, PAYOUT[row.payoutStatus] ?? '', money(row.paidCents), money(row.commissionCents), money(row.gatewayFeeCents), money(row.netCents), row.receiptNumber ?? '',
  ]);
  return String.fromCharCode(0xfeff) + [header, ...lines].map((line) => line.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

// ---- Administrador ----------------------------------------------------------------------------------------------------
export async function adminPayments({ status, page = 1, limit = 25 }) {
  const where = { provider: 'asaas', ...(status && { status }) };
  const [rows, total] = await prisma.$transaction([
    prisma.payment.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit, include: { order: { select: { uuid: true, titleSnapshot: true } }, client: { select: personSelect }, professional: { select: personSelect } } }),
    prisma.payment.count({ where }),
  ]);
  return {
    data: rows.map((payment) => ({
      uuid: bufferToUuid(payment.uuid), orderUuid: bufferToUuid(payment.order.uuid), service: payment.order.titleSnapshot, client: nameOf(payment.client), professional: nameOf(payment.professional),
      method: payment.method, status: payment.status, payoutStatus: payment.payoutStatus, amountCents: payment.amountCents, commissionCents: payment.commissionCents, clientFeeCents: payment.clientFeeCents,
      proShareCents: payment.proShareCents, refundedCents: payment.refundedCents, createdAt: payment.createdAt,
    })),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function adminSummary() {
  const since = new Date(Date.now() - 30 * 86400000);
  const [grouped, openDisputes, failedWebhooks, alerts, paid] = await Promise.all([
    prisma.payment.groupBy({ by: ['status'], where: { provider: 'asaas' }, _count: { _all: true } }),
    prisma.paymentDispute.count({ where: { status: 'open' } }),
    prisma.webhookEvent.count({ where: { provider: 'asaas', status: 'failed' } }),
    prisma.paymentEvent.count({ where: { type: { in: ALERT_TYPES }, createdAt: { gte: since } } }),
    prisma.payment.aggregate({ where: { provider: 'asaas', status: { in: ['confirmed', 'disputed'] } }, _sum: { commissionCents: true, clientFeeCents: true, amountCents: true } }),
  ]);
  const byStatus = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  return {
    byStatus, openDisputes, failedWebhooks, alerts,
    pendingPayments: byStatus.pending ?? 0,
    volumeCents: paid._sum.amountCents ?? 0,
    commissionCollectedCents: (paid._sum.commissionCents ?? 0) + (paid._sum.clientFeeCents ?? 0),
  };
}

export async function adminDisputes(status = 'open') {
  const rows = await prisma.paymentDispute.findMany({
    where: status === 'all' ? {} : { status }, orderBy: { id: 'desc' }, take: 100,
    include: { payment: { include: { order: { select: { uuid: true, titleSnapshot: true } }, client: { select: personSelect }, professional: { select: personSelect } } }, openedBy: { select: personSelect } },
  });
  return rows.map((row) => ({
    id: row.id.toString(), status: row.status, reason: row.reason, resolution: row.resolution, createdAt: row.createdAt, resolvedAt: row.resolvedAt, daysOpen: row.status === 'open' ? daysOpen(row.createdAt) : null, refundedCents: row.refundedCents,
    opener: nameOf(row.openedBy), method: row.payment.method,
    payment: { uuid: bufferToUuid(row.payment.uuid), status: row.payment.status, amountCents: row.payment.amountCents, formatted: formatCents(row.payment.amountCents ?? 0) },
    service: row.payment.order.titleSnapshot, orderUuid: bufferToUuid(row.payment.order.uuid), client: nameOf(row.payment.client), professional: nameOf(row.payment.professional),
  }));
}

export async function adminAlerts() {
  const rows = await prisma.paymentEvent.findMany({
    where: { type: { in: ALERT_TYPES } }, orderBy: { id: 'desc' }, take: 50,
    include: { payment: { include: { order: { select: { uuid: true, titleSnapshot: true } } } } },
  });
  return rows.map((row) => ({ id: row.id.toString(), kind: row.type.slice(6), detail: row.detail, createdAt: row.createdAt, paymentUuid: bufferToUuid(row.payment.uuid), service: row.payment.order.titleSnapshot }));
}

export async function adminWebhookEvents(status) {
  const rows = await prisma.webhookEvent.findMany({ where: { provider: 'asaas', ...(status && { status }) }, orderBy: { id: 'desc' }, take: 100 });
  return rows.map((row) => ({ id: row.id.toString(), event: row.eventName, reference: row.reference, status: row.status, error: row.status === 'ignored' ? null : row.error, note: row.status === 'ignored' ? ignoredText(row.error) : null, processedAt: row.processedAt }));
}
