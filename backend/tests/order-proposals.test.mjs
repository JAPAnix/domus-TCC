import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTransition, availableActions, parseProposal, urgency, deadlineOf, planExpiry, RESPONSE_HOURS, DEFAULT_VALIDITY_HOURS, ORDER_STATUS_LABELS } from '../src/utils/orderRules.js';

const CLIENT = 1n, PRO = 2n, STRANGER = 9n;
const HOUR = 3600000;
const NOW = new Date('2026-11-10T12:00:00.000Z');
const order = (extra = {}) => ({ status: 'requested', clientId: CLIENT, professionalId: PRO, pricingModelSnapshot: 'quote', ...extra });
const code = (fn) => { try { fn(); return null; } catch (e) { return e.status; } };

test('pedido sob consulta: o profissional propõe ou recusa, nunca aceita direto', () => {
  assert.deepEqual(availableActions(order(), PRO).sort(), ['decline', 'propose']);
  assert.equal(code(() => resolveTransition(order(), PRO, 'accept')), 409);
  assert.equal(resolveTransition(order(), PRO, 'propose').to, 'proposed');
});

test('pedido de preço fixo ("contratação imediata" sem proposta): aceita ou recusa, não propõe', () => {
  const fixed = order({ pricingModelSnapshot: 'fixed' });
  assert.deepEqual(availableActions(fixed, PRO).sort(), ['accept', 'decline']);
  assert.equal(code(() => resolveTransition(fixed, PRO, 'propose')), 409);
});

test('cliente decide a proposta: aceita (vai ao pagamento), recusa ou cancela', () => {
  const proposed = order({ status: 'proposed' });
  assert.deepEqual(availableActions(proposed, CLIENT).sort(), ['accept_proposal', 'cancel', 'reject_proposal']);
  assert.equal(resolveTransition(proposed, CLIENT, 'accept_proposal').to, 'accepted');
  assert.equal(resolveTransition(proposed, CLIENT, 'reject_proposal').to, 'cancelled');
  assert.deepEqual(availableActions(proposed, PRO), []);
});

test('transições inválidas e permissões', () => {
  assert.ok([403, 404].includes(code(() => resolveTransition(order(), STRANGER, 'propose'))));
  assert.ok(code(() => resolveTransition(order(), CLIENT, 'propose')) >= 400);
  assert.ok(code(() => resolveTransition(order(), CLIENT, 'accept_proposal')) >= 400);
  assert.ok(code(() => resolveTransition(order({ status: 'proposed' }), PRO, 'propose')) >= 400, 'não propõe duas vezes');
  assert.ok(code(() => resolveTransition(order({ status: 'proposed' }), PRO, 'decline')) >= 400);
  for (const status of ['expired', 'declined', 'completed']) assert.deepEqual(availableActions(order({ status }), PRO), [], status);
  assert.deepEqual(availableActions(order({ status: 'expired' }), CLIENT), []);
  assert.equal(ORDER_STATUS_LABELS.proposed, 'Proposta enviada');
  assert.equal(ORDER_STATUS_LABELS.expired, 'Expirado');
});

test('parseProposal: valida valor, prazo, validade e textos', () => {
  const ok = parseProposal({ amount: '150.5', days: 3, included: ' material ', valid_hours: 72 }, NOW);
  assert.equal(ok.amount, 150.5);
  assert.equal(ok.days, 3);
  assert.equal(ok.included, 'material');
  assert.equal(ok.validUntil.getTime(), NOW.getTime() + 72 * HOUR);
  assert.equal(parseProposal({ amount: 10, date: '2026-12-01' }, NOW).validHours, DEFAULT_VALIDITY_HOURS);
  for (const bad of [{}, { amount: 0, days: 1 }, { amount: -5, days: 1 }, { amount: 'abc', days: 1 }, { amount: 10 }, { amount: 10, days: 0 }, { amount: 10, days: 400 },
    { amount: 10, date: '2026-11-01' }, { amount: 10, date: '10/12/2026' }, { amount: 10, days: 2, valid_hours: 5 }, { amount: 10, days: 2, included: 'x'.repeat(501) }, { amount: 10, days: 2, note: 'x'.repeat(1001) }, { amount: 5e6, days: 1 }]) {
    assert.equal(code(() => parseProposal(bad, NOW)), 400, JSON.stringify(bad).slice(0, 60));
  }
});

test('urgency: prazo de resposta e validade da proposta', () => {
  assert.equal(urgency(order({ status: 'accepted' }), NOW), null);
  assert.equal(urgency(order({ expiresAt: new Date(NOW.getTime() + RESPONSE_HOURS * HOUR) }), NOW).level, 'ok');
  assert.equal(urgency(order({ expiresAt: new Date(NOW.getTime() + 10 * HOUR) }), NOW).level, 'soon');
  assert.equal(urgency(order({ expiresAt: new Date(NOW.getTime() + 2 * HOUR) }), NOW).level, 'urgent');
  assert.equal(urgency(order({ expiresAt: new Date(NOW.getTime() - HOUR) }), NOW).level, 'expired');
  const proposed = order({ status: 'proposed', proposalValidUntil: new Date(NOW.getTime() + 30 * HOUR), expiresAt: null });
  assert.equal(deadlineOf(proposed).getTime(), NOW.getTime() + 30 * HOUR);
  assert.equal(urgency(proposed, NOW).hoursLeft, 30);
});

test('planExpiry: expira o vencido, avisa o que vence em 24 h, ignora o resto', () => {
  const rows = [
    { id: 1, status: 'requested', expiresAt: new Date(NOW.getTime() - 1) },
    { id: 2, status: 'requested', expiresAt: new Date(NOW.getTime() + 5 * HOUR) },
    { id: 3, status: 'requested', expiresAt: new Date(NOW.getTime() + 60 * HOUR) },
    { id: 4, status: 'proposed', proposalValidUntil: new Date(NOW.getTime() - 5 * HOUR) },
    { id: 5, status: 'proposed', proposalValidUntil: new Date(NOW.getTime() + 20 * HOUR) },
    { id: 6, status: 'in_progress' },
  ];
  const plan = planExpiry(rows, NOW);
  assert.deepEqual(plan.toExpire, [1, 4]);
  assert.deepEqual(plan.toWarn.map((w) => w.id), [2, 5]);
  assert.equal(plan.toWarn[0].hoursLeft, 5);
});
