import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, proposalBlockers, meetsPreferences, planRequestExpiry, timeLeftText, countsTowardLimit, REPORT_REASONS } from '../src/utils/openRequestRules.js';
import { readOpenRequestConfig, requireOpenRequests } from '../src/config/openRequests.js';
import { opportunityWhere, serializeOpportunity, cleanRequestText } from '../src/services/openRequests.js';

const HOUR = 3600000;
const NOW = new Date('2026-11-10T12:00:00.000Z');
const json = (value) => JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? String(v) : v));

test('transições do pedido aberto: válidas e inválidas', () => {
  for (const [from, to] of [['draft', 'open'], ['open', 'in_progress'], ['open', 'expired'], ['open', 'removed'], ['expired', 'open'], ['in_progress', 'completed'], ['open', 'cancelled']]) assert.ok(canTransition(from, to), `${from}->${to}`);
  for (const [from, to] of [['completed', 'open'], ['cancelled', 'open'], ['removed', 'open'], ['in_progress', 'open'], ['in_progress', 'removed'], ['open', 'completed'], ['expired', 'in_progress']]) assert.ok(!canTransition(from, to), `${from}->${to}`);
});

test('quem pode propor: perfil, perfil completo e recebimento aprovado (só com Asaas)', () => {
  assert.deepEqual(proposalBlockers({ hasProfile: true, asaasActive: false }), []);
  assert.match(proposalBlockers({ hasProfile: false, asaasActive: false })[0], /Crie o seu perfil/);
  assert.match(proposalBlockers({ hasProfile: true, profileComplete: false, asaasActive: false })[0], /Complete o seu perfil/);
  assert.match(proposalBlockers({ hasProfile: true, asaasActive: true, payoutStatus: 'pending' })[0], /conta de recebimento/);
  assert.deepEqual(proposalBlockers({ hasProfile: true, asaasActive: true, payoutStatus: 'approved' }), []);
});

test('preferências do cliente: verificado e nota mínima', () => {
  assert.ok(meetsPreferences({ onlyVerified: false, minRating: null }, { isVerified: false, averageRating: 0 }));
  assert.ok(!meetsPreferences({ onlyVerified: true }, { isVerified: false, averageRating: 5 }));
  assert.ok(meetsPreferences({ onlyVerified: true }, { isVerified: true, averageRating: 0 }));
  assert.ok(!meetsPreferences({ minRating: '4.0' }, { isVerified: true, averageRating: '3.90' }));
  assert.ok(meetsPreferences({ minRating: '4.0' }, { isVerified: false, averageRating: '4.00' }));
});

test('limite de propostas conta só as que ainda valem', () => {
  assert.deepEqual(['pending', 'accepted', 'rejected', 'withdrawn', 'expired'].map(countsTowardLimit), [true, true, false, false, false]);
});

test('expiração: vencidos expiram, quem vence em 24 h ganha aviso, propostas vencidas expiram', () => {
  const plan = planRequestExpiry({
    services: [
      { id: 1, status: 'open', expiresAt: new Date(NOW.getTime() - 1) }, { id: 2, status: 'open', expiresAt: new Date(NOW.getTime() + 5 * HOUR) },
      { id: 3, status: 'open', expiresAt: new Date(NOW.getTime() + 60 * HOUR) }, { id: 4, status: 'in_progress', expiresAt: new Date(NOW.getTime() - HOUR) }, { id: 5, status: 'open', expiresAt: null },
    ],
    proposals: [{ id: 10, validUntil: new Date(NOW.getTime() - 1) }, { id: 11, validUntil: new Date(NOW.getTime() + HOUR) }, { id: 12, validUntil: null }],
  }, NOW);
  assert.deepEqual(plan.toExpire, [1]);
  assert.deepEqual(plan.toWarn, [{ id: 2, hoursLeft: 5 }]);
  assert.deepEqual(plan.proposalsToExpire, [10]);
  assert.equal(timeLeftText(1), 'menos de 1 hora');
  assert.equal(timeLeftText(5), '5 horas');
  assert.equal(timeLeftText(72), '3 dias');
});

test('configuração: valores padrão, limites e o interruptor OPEN_REQUESTS_ENABLED', () => {
  const base = readOpenRequestConfig({});
  assert.deepEqual([base.enabled, base.maxProposals, base.defaultDays, base.digestHours], [true, 5, 7, 6]);
  assert.equal(readOpenRequestConfig({ OPEN_REQUESTS_ENABLED: 'false' }).enabled, false);
  assert.equal(readOpenRequestConfig({ OPEN_REQUESTS_ENABLED: 'FALSE' }).enabled, false);
  assert.equal(readOpenRequestConfig({ OPEN_REQUEST_MAX_PROPOSALS: '8' }).maxProposals, 8);
  assert.equal(readOpenRequestConfig({ OPEN_REQUEST_MAX_PROPOSALS: 'abc' }).maxProposals, 5);
  assert.equal(readOpenRequestConfig({ OPEN_REQUEST_MAX_PROPOSALS: '999' }).maxProposals, 5);
});

test('rotas bloqueadas (404) quando o recurso está desligado', () => {
  const previous = process.env.OPEN_REQUESTS_ENABLED;
  const run = () => { const out = {}; requireOpenRequests({}, { status(code) { out.code = code; return { json(body) { out.body = body; } }; } }, () => { out.next = true; }); return out; };
  try {
    process.env.OPEN_REQUESTS_ENABLED = 'false';
    assert.equal(run().code, 404);
    process.env.OPEN_REQUESTS_ENABLED = 'true';
    assert.equal(run().next, true);
  } finally { if (previous === undefined) delete process.env.OPEN_REQUESTS_ENABLED; else process.env.OPEN_REQUESTS_ENABLED = previous; }
});

test('oportunidades: filtra por categoria e estado dos anúncios, esconde as próprias, as dispensadas e as bloqueadas', () => {
  const scope = { profile: { isVerified: false, averageRating: 3.5 }, categoryIds: [4, 7], states: ['PR'], hasListing: true, blocked: [99n] };
  const where = opportunityWhere(5n, scope, {}, NOW);
  assert.equal(where.status, 'open');
  assert.deepEqual(where.clientId, { notIn: [5n, 99n] });
  const text = json(where);
  for (const part of ['"categoryId":{"in":[4,7]}', '"state":{"in":["PR"]}', '"dismissedAt":{"not":null}', '"onlyVerified":false', '"minRating":{"lte":3.5}']) assert.ok(text.includes(part), part);
  // Sem anúncio: mostra tudo (a tela avisa para criar um serviço).
  assert.ok(!json(opportunityWhere(5n, { ...scope, hasListing: false, categoryIds: [], states: [] }, {}, NOW)).includes('"categoryId":{"in"'));
  // Filtros e "só novas".
  const filtered = json(opportunityWhere(5n, scope, { category_id: '7', city: 'Curitiba', urgency: 'soon', only_new: 'true' }, NOW));
  for (const part of ['"categoryId":7', '"city":"Curitiba"', '"expiresAt":{"lte"', '"views":{"some":{"userId":"5"}}']) assert.ok(filtered.includes(part), part);
});

test('cartão da oportunidade: limite de propostas, "nova" e a proposta do próprio profissional', () => {
  const row = {
    uuid: Buffer.alloc(16, 1), title: 'Pintar sala', description: 'x'.repeat(300), category: { id: 1, name: 'Reformas' }, city: 'Curitiba', state: 'PR', neighborhood: null, deadline: null,
    budgetMin: null, budgetMax: '500.00', images: [], createdAt: NOW, expiresAt: new Date(NOW.getTime() + 5 * HOUR), maxProposals: 2,
    client: { uuid: Buffer.alloc(16, 2), firstName: 'Ana', lastName: 'Souza', preferredName: null },
    views: [], proposals: [{ status: 'pending', professionalId: 8n }, { status: 'accepted', professionalId: 9n }, { status: 'rejected', professionalId: 5n }],
  };
  const card = serializeOpportunity(row, 5n, NOW);
  assert.equal(card.description.length, 218);
  assert.equal(card.proposalsCount, 2);
  assert.equal(card.limitReached, true);
  assert.equal(card.isNew, true);
  assert.equal(card.hoursLeft, 5);
  assert.equal(card.myProposalStatus, 'rejected');
  assert.equal(card.budgetMax, 500);
  assert.equal(serializeOpportunity({ ...row, views: [{ firstSeenAt: NOW }] }, 5n, NOW).isNew, false);
  assert.ok(!JSON.stringify(card).includes('email'));
});

test('texto do pedido: contato escondido no título e na descrição', () => {
  const out = cleanRequestText({ title: 'Pintar sala, ligue 41 99999-1234', description: 'Mande e-mail para ana@x.com' });
  assert.equal(out.masked, true);
  assert.ok(!/99999|ana@/.test(out.title + out.description));
  assert.equal(cleanRequestText({ title: 'Pintar sala', description: 'Duas demãos em 20 m².' }).masked, false);
  assert.ok(Object.keys(REPORT_REASONS).includes('contact'));
});
