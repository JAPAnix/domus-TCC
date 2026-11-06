import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, planAccountEvent, planPaymentEvent, rejectionText } from '../src/utils/asaasEvents.js';

const NOW = new Date('2026-11-06T12:00:00Z');
const plan = (name, payment, options = {}) => planPaymentEvent({ id: 'evt_1', event: name, payment: { id: 'pay_1' } }, payment, { now: NOW, ...options });

test('pagamento confirmado: vira "pago" e o valor fica retido', () => {
  const result = plan('PAYMENT_CONFIRMED', { status: 'pending', payoutStatus: 'none' });
  assert.equal(result.action, 'apply');
  assert.equal(result.to, 'confirmed');
  assert.deepEqual(result.patch, { status: 'confirmed', confirmedAt: NOW, payoutStatus: 'held' });
  assert.equal(plan('PAYMENT_RECEIVED', { status: 'expired' }).to, 'confirmed');
});

test('evento repetido não muda nada (idempotência no nível do estado)', () => {
  assert.deepEqual(plan('PAYMENT_RECEIVED', { status: 'confirmed' }), { action: 'ignore', reason: 'sem_mudanca' });
  assert.deepEqual(plan('PAYMENT_OVERDUE', { status: 'expired' }), { action: 'ignore', reason: 'sem_mudanca' });
  assert.deepEqual(plan('PAYMENT_REFUNDED', { status: 'refunded' }), { action: 'ignore', reason: 'sem_mudanca' });
});

test('transições inválidas são ignoradas e dinheiro recebido depois do fim gera alerta', () => {
  assert.equal(plan('PAYMENT_OVERDUE', { status: 'confirmed' }).reason, 'transicao_invalida');
  assert.equal(plan('PAYMENT_REFUNDED', { status: 'pending' }).reason, 'transicao_invalida');
  const late = plan('PAYMENT_RECEIVED', { status: 'cancelled' });
  assert.deepEqual(late, { action: 'ignore', reason: 'estado_final', alert: 'paid_after_close' });
  assert.equal(plan('PAYMENT_RECEIVED', { status: 'refunded' }).alert, 'paid_after_close');
  assert.equal(plan('PAYMENT_ALGUMA_COISA_NOVA', { status: 'pending' }).reason, 'evento_desconhecido');
});

test('expirado, recusado e cancelado', () => {
  assert.equal(plan('PAYMENT_OVERDUE', { status: 'pending' }).to, 'expired');
  assert.equal(plan('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', { status: 'pending' }).to, 'refused');
  assert.equal(plan('PAYMENT_DELETED', { status: 'pending' }).patch.cancelledAt, NOW);
  assert.equal(plan('PAYMENT_DELETED', { status: 'confirmed' }).reason, 'transicao_invalida');
});

test('estorno registra o valor e o repasse', () => {
  const result = plan('PAYMENT_REFUNDED', { status: 'confirmed', amountCents: 17000 });
  assert.deepEqual(result.patch, { status: 'refunded', refundedAt: NOW, payoutStatus: 'refunded', refundedCents: 17000 });
  assert.equal(plan('PAYMENT_PARTIALLY_REFUNDED', { status: 'confirmed' }).notice, 'partial_refund');
  assert.deepEqual(plan('PAYMENT_PARTIALLY_REFUNDED', { status: 'confirmed' }).patch, {});
});

test('chargeback gera alerta e mantém o valor retido', () => {
  const result = plan('PAYMENT_CHARGEBACK_REQUESTED', { status: 'confirmed' });
  assert.equal(result.to, 'chargeback');
  assert.equal(result.alert, 'chargeback');
  assert.equal(result.patch.payoutStatus, undefined);
  assert.equal(plan('PAYMENT_REFUNDED', { status: 'chargeback' }).to, 'refunded');
});

test('split concluído só libera o repasse quando não há garantia', () => {
  const free = plan('PAYMENT_SPLIT_DONE', { status: 'confirmed', payoutStatus: 'held' }, { escrowEnabled: false });
  assert.deepEqual(free.patch, { payoutStatus: 'released', releasedAt: NOW });
  assert.equal(plan('PAYMENT_SPLIT_DONE', { status: 'confirmed', payoutStatus: 'held' }, { escrowEnabled: true }).reason, 'split_com_garantia');
  assert.equal(plan('PAYMENT_SPLIT_DONE', { status: 'pending' }).reason, 'split_fora_de_estado');
  assert.equal(plan('PAYMENT_SPLIT_DONE', { status: 'confirmed', payoutStatus: 'released' }).action, 'ignore');
  assert.equal(plan('PAYMENT_SPLIT_DIVERGENCE_BLOCK', { status: 'confirmed' }).alert, 'split_problem');
  assert.equal(plan('PAYMENT_SPLIT_CANCELLED', { status: 'confirmed' }).alert, 'split_problem');
});

test('tabela de transições', () => {
  assert.equal(canTransition('pending', 'confirmed'), true);
  assert.equal(canTransition('confirmed', 'pending'), false);
  assert.equal(canTransition('refunded', 'confirmed'), false);
  assert.equal(canTransition('disputed', 'confirmed'), true);
  assert.equal(canTransition('inexistente', 'confirmed'), false);
});

test('situação da conta de recebimento', () => {
  const approved = planAccountEvent({ event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED', accountStatus: { general: 'APPROVED', commercialInfo: 'APPROVED', bankAccountInfo: 'APPROVED', documentation: 'APPROVED' } });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.rejectionReason, null);
  const rejected = planAccountEvent({ event: 'ACCOUNT_STATUS_DOCUMENT_REJECTED', accountStatus: { general: 'AWAITING_APPROVAL', documentation: 'REJECTED', bankAccountInfo: 'APPROVED', commercialInfo: 'APPROVED' } });
  assert.equal(rejected.status, 'rejected');
  assert.match(rejected.rejectionReason, /documentos enviados foram recusados/);
  assert.equal(planAccountEvent({ event: 'ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING', accountStatus: { general: 'PENDING', commercialInfo: 'PENDING' } }).status, 'pending');
  assert.equal(planAccountEvent({ event: 'PAYMENT_RECEIVED' }).action, 'ignore');
  assert.equal(planAccountEvent({ event: 'ACCOUNT_STATUS_X' }).action, 'ignore');
  assert.match(rejectionText({ bankAccountInfo: 'REJECTED', commercialInfo: 'REJECTED' }), /bancários.*cadastrais/);
  assert.match(rejectionText({}), /recusou o cadastro/);
});

test('situação da conta vira texto legível (nunca um objeto)', async () => {
  const { describeAccountDetail } = await import('../src/utils/asaasEvents.js');
  assert.equal(describeAccountDetail({ commercialInfo: 'APPROVED', bankAccountInfo: 'PENDING', documentation: 'AWAITING_APPROVAL', general: 'PENDING' }), 'Pendente: documentos, dados bancários.');
  assert.equal(describeAccountDetail({ commercialInfo: 'APPROVED', bankAccountInfo: 'APPROVED', documentation: 'APPROVED' }), null);
  assert.equal(describeAccountDetail(null), null);
  assert.equal(typeof describeAccountDetail({ documentation: 'PENDING' }), 'string');
});
