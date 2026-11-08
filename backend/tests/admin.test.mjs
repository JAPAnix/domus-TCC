import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResolution, daysOpen } from '../src/utils/disputeRules.js';
import { ALERT_INFO, IGNORED_REASONS, ignoredText } from '../src/utils/adminAlerts.js';
import { ALERT_TYPES } from '../src/utils/asaasEvents.js';
import { listAlerts, listAudit, resolveAlert, transactionsCsv, transactionsReport } from '../src/services/adminService.js';

const uuid = (n) => Buffer.from(String(n).padStart(32, '0'), 'hex');
const NOW = new Date('2026-11-10T12:00:00.000Z');
const NOTE = 'Conferi as fotos e a conversa das duas partes.';

// ---- decisão da reclamação ----
test('decisão: a justificativa é obrigatória (de 10 a 500 caracteres)', () => {
  for (const note of [undefined, '', '   ', 'curto', 'x'.repeat(501)]) assert.throws(() => parseResolution({ decision: 'release', note }, { amountCents: 10000 }), (e) => e.status === 400 && /justificativa/.test(e.message), String(note).slice(0, 10));
  assert.equal(parseResolution({ decision: 'release', note: NOTE }, { amountCents: 10000 }).kind, 'release');
});

test('decisão: escolher reembolsar ou manter; qualquer outra coisa é recusada', () => {
  assert.throws(() => parseResolution({ decision: 'talvez', note: NOTE }, { amountCents: 100 }), (e) => e.status === 400);
  assert.throws(() => parseResolution({ note: NOTE }, { amountCents: 100 }), (e) => e.status === 400);
});

test('reembolso: sem valor é total; com valor menor é parcial; valor igual ao total vale como total', () => {
  assert.deepEqual(parseResolution({ decision: 'refund', note: NOTE }, { amountCents: 25000 }), { kind: 'refund', note: NOTE, refundCents: 25000 });
  assert.deepEqual(parseResolution({ decision: 'refund', note: NOTE, refundCents: 10000 }, { amountCents: 25000 }), { kind: 'partial', note: NOTE, refundCents: 10000 });
  assert.equal(parseResolution({ decision: 'refund', note: NOTE, refundCents: 25000 }, { amountCents: 25000 }).kind, 'refund');
});

test('reembolso: valor zero, quebrado ou maior que o pago é recusado', () => {
  for (const refundCents of [0, -5, 1.5, 'abc', 25001]) assert.throws(() => parseResolution({ decision: 'refund', note: NOTE, refundCents }, { amountCents: 25000 }), (e) => e.status === 400, String(refundCents));
});

test('manter o pagamento ignora qualquer valor de reembolso enviado', () => {
  assert.equal(parseResolution({ decision: 'release', note: NOTE, refundCents: 5000 }, { amountCents: 25000 }).refundCents, 0);
});

test('dias em aberto: dias inteiros, nunca negativo', () => {
  assert.equal(daysOpen('2026-11-10T08:00:00.000Z', NOW), 0);
  assert.equal(daysOpen('2026-11-07T11:00:00.000Z', NOW), 3);
  assert.equal(daysOpen('2026-11-11T00:00:00.000Z', NOW), 0);
});

// ---- textos de ajuda ----
test('todo tipo de alerta tem título, significado, por que importa e ação, em português', () => {
  const kinds = [...ALERT_TYPES.map((type) => type.slice(6)), 'stale_pending', 'webhook_failed', 'pro_without_account'];
  for (const kind of kinds) {
    const info = ALERT_INFO[kind];
    assert.ok(info, `faltou texto para ${kind}`);
    for (const field of ['title', 'meaning', 'why', 'action']) assert.ok(String(info[field]).length > 15, `${kind}.${field}`);
    assert.ok(['high', 'medium', 'low'].includes(info.severity), kind);
  }
});

test('eventos ignorados do gateway são explicados, não tratados como erro', () => {
  assert.match(ignoredText('evento_desconhecido'), /não usa/);
  assert.match(ignoredText('sem_mudanca'), /já estava/);
  assert.ok(ignoredText('motivo_novo_qualquer').length > 10);
  for (const reason of Object.keys(IGNORED_REASONS)) assert.ok(IGNORED_REASONS[reason].length > 15);
});

// ---- alertas e auditoria (banco em memória) ----
function fakeAdminDb({ events = [], stale = [], failed = [], pros = [] } = {}) {
  const audit = [];
  const hasType = (row, where) => where.type.in.includes(row.type);
  return {
    audit,
    paymentEvent: {
      findMany: async ({ where }) => events.filter((row) => hasType(row, where) && (where.resolvedAt === undefined || (where.resolvedAt === null ? row.resolvedAt === null : row.resolvedAt !== null))).sort((a, b) => Number(b.id - a.id)).map((row) => ({ ...row, payment: { uuid: uuid(row.id), order: { uuid: uuid(row.id + 100n), titleSnapshot: 'Pintura' } } })),
      findUnique: async ({ where }) => events.find((row) => row.id === where.id) ?? null,
      update: async ({ where, data }) => { Object.assign(events.find((row) => row.id === where.id), data); },
    },
    payment: { findMany: async () => stale.map((row) => ({ ...row, uuid: uuid(row.id), order: { uuid: uuid(row.id + 200n), titleSnapshot: 'Aula' } })) },
    webhookEvent: { findMany: async () => failed },
    user: { findMany: async ({ where }) => (where.id ? [{ id: 1n, firstName: 'Ana', lastName: 'Admin' }] : pros) },
    adminAuditLog: { create: async ({ data }) => { audit.push({ id: BigInt(audit.length + 1), createdAt: NOW, ...data }); }, findMany: async () => [...audit].reverse() },
  };
}
const event = (id, type, extra = {}) => ({ id, type, detail: 'detalhe', createdAt: new Date(NOW.getTime() - Number(id) * 1000), resolvedAt: null, resolvedById: null, resolutionNote: null, ...extra });

test('alertas abertos: os mais graves primeiro; resolvidos ficam fora da lista de abertos', async () => {
  const db = fakeAdminDb({ events: [event(1n, 'alert:split_problem'), event(2n, 'alert:chargeback'), event(3n, 'alert:release_failed', { resolvedAt: NOW, resolutionNote: 'ok' })] });
  const open = await listAlerts(db, { status: 'open', now: NOW });
  assert.deepEqual(open.map((a) => a.kind), ['chargeback', 'split_problem']);
  assert.deepEqual(open.map((a) => a.severity), ['high', 'medium']);
  assert.ok(open.every((a) => a.resolvable && a.meaning && a.why && a.action));
  const resolved = await listAlerts(db, { status: 'resolved', now: NOW });
  assert.deepEqual(resolved.map((a) => a.kind), ['release_failed']);
  assert.equal(resolved[0].resolutionNote, 'ok');
  assert.equal((await listAlerts(db, { status: 'all', now: NOW })).length, 3);
});

test('alertas calculados: pagamento parado, aviso do gateway e profissional sem conta (só abertos, sem botão de resolver)', async () => {
  const db = fakeAdminDb({
    stale: [{ id: 7n, amountCents: 5000, createdAt: new Date(NOW.getTime() - 5 * 86400000) }],
    failed: [{ id: 9n, eventName: 'PAYMENT_RECEIVED', reference: 'pay_1', error: 'banco fora do ar', processedAt: NOW, createdAt: NOW }],
    pros: [{ id: 4n, firstName: 'Beto', lastName: 'Pro', createdAt: NOW, payoutAccount: { status: 'pending' } }],
  });
  const open = await listAlerts(db, { status: 'open', now: NOW, asaasEnabled: true });
  assert.deepEqual(open.map((a) => a.kind).sort(), ['pro_without_account', 'stale_pending', 'webhook_failed']);
  assert.ok(open.every((a) => a.resolvable === false));
  assert.match(open.find((a) => a.kind === 'stale_pending').detail, /5 dias/);
  assert.match(open.find((a) => a.kind === 'pro_without_account').detail, /em análise/);
  assert.equal((await listAlerts(db, { status: 'open', now: NOW, asaasEnabled: false })).some((a) => a.kind === 'pro_without_account'), false);
  assert.equal((await listAlerts(db, { status: 'resolved', now: NOW, asaasEnabled: true })).length, 0);
});

test('resolver alerta: guarda quem, quando e a nota, registra na auditoria e tira dos abertos', async () => {
  const db = fakeAdminDb({ events: [event(2n, 'alert:chargeback')] });
  await resolveAlert(db, 1n, '2', 'Respondi a contestação com as provas.');
  assert.notEqual(db.paymentEvent.findUnique && (await db.paymentEvent.findUnique({ where: { id: 2n } })).resolvedAt, null);
  assert.equal((await db.paymentEvent.findUnique({ where: { id: 2n } })).resolvedById, 1n);
  assert.equal(db.audit.length, 1);
  assert.equal(db.audit[0].action, 'alert.resolve');
  assert.match(db.audit[0].detail, /chargeback.*Respondi/);
  assert.equal((await listAlerts(db, { status: 'open', now: NOW })).length, 0);
  const log = await listAudit(db);
  assert.equal(log[0].admin, 'Ana Admin');
  assert.equal(log[0].actionLabel, 'Marcou um alerta como resolvido');
});

test('resolver alerta: nota curta, alerta calculado, inexistente e repetido são recusados', async () => {
  const db = fakeAdminDb({ events: [event(2n, 'alert:chargeback'), event(5n, 'payment_confirmed')] });
  await assert.rejects(resolveAlert(db, 1n, '2', 'ok'), (e) => e.status === 400);
  await assert.rejects(resolveAlert(db, 1n, 'c:stale:7', 'Cliente avisado por mensagem.'), (e) => e.status === 400 && /some sozinho/.test(e.message));
  await assert.rejects(resolveAlert(db, 1n, '99', 'Cliente avisado por mensagem.'), (e) => e.status === 404);
  await assert.rejects(resolveAlert(db, 1n, '5', 'Cliente avisado por mensagem.'), (e) => e.status === 404, 'só alertas, nunca outros eventos');
  await resolveAlert(db, 1n, '2', 'Cliente avisado por mensagem.');
  await assert.rejects(resolveAlert(db, 1n, '2', 'Cliente avisado por mensagem.'), (e) => e.status === 409);
  assert.equal(db.audit.length, 1);
});

// ---- transações e comissões ----
function fakePaymentsDb(rows) {
  return { payment: { findMany: async ({ where }) => rows.filter((row) => !where.createdAt || ((!where.createdAt.gte || row.createdAt >= where.createdAt.gte) && (!where.createdAt.lt || row.createdAt < where.createdAt.lt))).map((row) => ({ uuid: uuid(row.id), order: { uuid: uuid(row.id + 100n), titleSnapshot: row.service ?? 'Pintura de sala' }, client: { firstName: 'Maria', lastName: 'Cli' }, professional: { firstName: 'João', lastName: 'Pro' }, method: 'pix', payoutStatus: 'held', clientFeeCents: 0, refundedCents: 0, ...row })) } };
}
test('relatório: volume pago, comissão (só do que não foi estornado) e estornos por período', async () => {
  const db = fakePaymentsDb([
    { id: 1n, status: 'confirmed', amountCents: 25000, commissionCents: 2500, createdAt: new Date('2026-11-02T10:00:00Z') },
    { id: 2n, status: 'confirmed', amountCents: 10000, commissionCents: 1000, clientFeeCents: 500, refundedCents: 5000, createdAt: new Date('2026-11-03T10:00:00Z') },
    { id: 3n, status: 'refunded', amountCents: 8000, commissionCents: 800, refundedCents: 8000, createdAt: new Date('2026-11-04T10:00:00Z') },
    { id: 4n, status: 'pending', amountCents: 9000, commissionCents: 900, createdAt: new Date('2026-12-20T10:00:00Z') },
  ]);
  const all = await transactionsReport(db, {});
  assert.equal(all.totals.count, 4);
  assert.equal(all.totals.paidCents, 35000);
  assert.equal(all.totals.refundedCents, 13000);
  assert.equal(all.totals.commissionCents, 2500 + 750, 'o 2º pagamento (R$ 15,00 de plataforma) perdeu metade no estorno parcial');
  assert.deepEqual(all.totals.byStatus, { confirmed: 2, refunded: 1, pending: 1 });
  const november = await transactionsReport(db, { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(november.totals.count, 3);
  assert.equal((await transactionsReport(db, { from: 'lixo', to: '2026-11-03' })).totals.count, 2, 'data inválida é ignorada; o fim do dia entra');
});

test('CSV: BOM, ponto e vírgula, decimal com vírgula e aspas quando precisa', async () => {
  const db = fakePaymentsDb([{ id: 1n, status: 'confirmed', amountCents: 25050, commissionCents: 2505, service: 'Pintura; "sala" e quarto', createdAt: new Date('2026-11-02T10:00:00Z') }]);
  const csv = transactionsCsv((await transactionsReport(db, {})).rows);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const [header, line] = csv.slice(1).split('\r\n');
  assert.equal(header.split(';').length, 9);
  assert.match(line, /^2026-11-02;"Pintura; ""sala"" e quarto";Maria Cli;João Pro;Pix;Pago;250,50;25,05;0,00$/);
});
