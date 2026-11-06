import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { crc16, buildPixBrCode, parseBrCode, pixKeyFromBrCode, asciiUpper } from '../src/utils/pixBrCode.js';
import { amountDue, availablePaymentActions, resolvePaymentAction, parseAcceptedMethods } from '../src/utils/paymentRules.js';
import { verifyWebhookSignature, MERCADOPAGO_STATUS_MAP } from '../src/services/payments/mercadopagoProvider.js';
import { ManualProvider } from '../src/services/payments/manualProvider.js';
import { activeProvider } from '../src/services/payments/index.js';
import { maskKey } from '../src/services/paymentWorkflow.js';

test('CRC16-CCITT bate com o vetor padrão', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('BR Code estático: estrutura, valor e CRC válidos', () => {
  const code = buildPixBrCode({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Maria da Conceição', city: 'São Paulo', amount: 150 });
  const { fields, crcOk } = parseBrCode(code);
  assert.equal(crcOk, true);
  assert.equal(fields['00'], '01');
  assert.equal(fields['53'], '986');
  assert.equal(fields['54'], '150.00');
  assert.equal(fields['58'], 'BR');
  assert.equal(fields['59'], 'MARIA DA CONCEICAO');
  assert.equal(fields['60'], 'SAO PAULO');
  assert.equal(pixKeyFromBrCode(code), '123e4567-e12b-12d1-a456-426655440000');
  assert.match(code, /^000201/);
});

test('BR Code: nome e cidade são cortados no tamanho do padrão e sem acentos', () => {
  assert.equal(asciiUpper('Ação Ótima de Serviços Gerais Ltda', 25).length <= 25, true);
  const code = buildPixBrCode({ key: 'a@b.com', name: 'x'.repeat(60), city: 'y'.repeat(40), amount: 1 });
  const { fields } = parseBrCode(code);
  assert.equal(fields['59'].length, 25);
  assert.equal(fields['60'].length, 15);
  assert.throws(() => buildPixBrCode({ key: '', name: 'A', city: 'B' }));
});

test('BR Code sem valor não inclui o campo 54', () => {
  const { fields } = parseBrCode(buildPixBrCode({ key: '+5541999998888', name: 'Ana', city: 'Curitiba' }));
  assert.equal(fields['54'], undefined);
});

test('valor a pagar: preço fixo com deslocamento, ou valor final', () => {
  assert.equal(amountDue({ pricingModelSnapshot: 'fixed', priceSnapshot: '120.00', travelFeeSnapshot: '20.00', finalAmount: null }), 140);
  assert.equal(amountDue({ pricingModelSnapshot: 'hourly', priceSnapshot: '50.00', finalAmount: null }), null);
  assert.equal(amountDue({ pricingModelSnapshot: 'hourly', priceSnapshot: '50.00', finalAmount: '310.005' }), 310.01);
  assert.equal(amountDue({ pricingModelSnapshot: 'quote', priceSnapshot: null, finalAmount: null }), null);
});

const payment = (status) => ({ status, clientId: 1n, professionalId: 2n });

test('permissões e estados do pagamento', () => {
  assert.deepEqual(availablePaymentActions(payment('pending'), 1n), ['report', 'cancel']);
  assert.deepEqual(availablePaymentActions(payment('pending'), 2n), ['confirm', 'cancel']);
  assert.deepEqual(availablePaymentActions(payment('reported'), 2n), ['confirm', 'reject', 'cancel']);
  assert.deepEqual(availablePaymentActions(payment('confirmed'), 2n), ['refund']);
  assert.deepEqual(availablePaymentActions(payment('confirmed'), 1n), []);
  assert.deepEqual(availablePaymentActions(payment('refunded'), 2n), []);
  assert.throws(() => resolvePaymentAction(payment('pending'), 3n, 'confirm'), (error) => error.status === 404);
  assert.throws(() => resolvePaymentAction(payment('pending'), 1n, 'confirm'), (error) => error.status === 403);
  assert.throws(() => resolvePaymentAction(payment('confirmed'), 2n, 'confirm'), (error) => error.status === 409);
  assert.throws(() => resolvePaymentAction(payment('pending'), 2n, 'inventada'), (error) => error.status === 404);
});

test('provedor automático desliga os cliques de report/confirm/reject', () => {
  assert.throws(() => resolvePaymentAction(payment('pending'), 2n, 'confirm', { manual: false }), (error) => error.status === 409);
  assert.deepEqual(availablePaymentActions(payment('pending'), 1n, { manual: false }), ['cancel']);
  assert.deepEqual(availablePaymentActions(payment('confirmed'), 2n, { manual: false }), ['refund']);
});

test('formas de pagamento aceitas ignoram valores desconhecidos', () => {
  assert.deepEqual(parseAcceptedMethods('pix, cash,bitcoin'), ['pix', 'cash']);
  assert.deepEqual(parseAcceptedMethods(null), ['pix']);
});

function sign({ id, requestId, ts, secret }) {
  return `ts=${ts},v1=${crypto.createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex')}`;
}

test('webhook: assinatura válida passa, adulterada e expirada falham', () => {
  const secret = 'segredo-de-teste';
  const now = Date.now();
  const ts = String(now);
  const good = sign({ id: 'abc123', requestId: 'req-1', ts, secret });
  assert.equal(verifyWebhookSignature({ signature: good, requestId: 'req-1', dataId: 'ABC123', secret, now }), 'ABC123');
  assert.throws(() => verifyWebhookSignature({ signature: good, requestId: 'req-2', dataId: 'abc123', secret, now }), (error) => error.status === 401);
  assert.throws(() => verifyWebhookSignature({ signature: good, requestId: 'req-1', dataId: 'outro', secret, now }), (error) => error.status === 401);
  assert.throws(() => verifyWebhookSignature({ signature: good, requestId: 'req-1', dataId: 'abc123', secret: 'errado', now }), (error) => error.status === 401);
  assert.throws(() => verifyWebhookSignature({ signature: undefined, requestId: 'req-1', dataId: 'abc123', secret, now }), (error) => error.status === 401);
  assert.throws(() => verifyWebhookSignature({ signature: good, requestId: 'req-1', dataId: 'abc123', secret: '', now }), (error) => error.status === 503);
  const old = sign({ id: 'abc123', requestId: 'req-1', ts: String(now - 3600_000), secret });
  assert.throws(() => verifyWebhookSignature({ signature: old, requestId: 'req-1', dataId: 'abc123', secret, now }), (error) => error.status === 401);
});

test('status do Mercado Pago são traduzidos para os nossos', () => {
  assert.equal(MERCADOPAGO_STATUS_MAP.approved, 'confirmed');
  assert.equal(MERCADOPAGO_STATUS_MAP.expired, 'cancelled');
  assert.equal(MERCADOPAGO_STATUS_MAP.refunded, 'refunded');
});

test('sem configuração completa o provedor ativo é o pagamento direto', () => {
  const saved = { ...process.env };
  process.env.PAYMENT_PROVIDER = 'mercadopago';
  delete process.env.MP_ACCESS_TOKEN;
  assert.equal(activeProvider().name, 'manual');
  Object.assign(process.env, saved);
});

test('provedor manual gera o BR Code só para Pix', async () => {
  const provider = new ManualProvider();
  const receiver = { pixKey: 'a@b.com', name: 'Ana', city: 'Curitiba' };
  const pix = await provider.createCharge({ payment: { method: 'pix', amount: '10.00' }, receiver });
  assert.equal(parseBrCode(pix.pixPayload).crcOk, true);
  assert.deepEqual(await provider.createCharge({ payment: { method: 'cash', amount: '10.00' }, receiver }), {});
});

test('a chave Pix aparece mascarada', () => {
  assert.equal(maskKey('12345678909'), '123***09');
  assert.equal(maskKey('maria@exemplo.com'), 'ma***@exemplo.com');
  assert.equal(maskKey(null), null);
});
