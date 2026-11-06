import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AsaasProvider, mapAccountStatus } from '../src/services/payments/asaasProvider.js';
import { AsaasError, asaasBaseUrl, asaasConfigured, ASAAS_STATUS } from '../src/services/payments/asaasClient.js';
import { encryptSecret, decryptSecret, generateSecretsKey } from '../src/utils/secretBox.js';
import { computeCheckout } from '../src/utils/money.js';

// ---- Asaas simulado: guarda as chamadas e responde como a documentação descreve ----
let server;
let calls;
let behavior;
const env = { ASAAS_API_KEY: 'chave-da-plataforma', ASAAS_WEBHOOK_TOKEN: 'x'.repeat(40), ASAAS_BASE_URL: '' };

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      calls.push({ method: req.method, path: req.url, key: req.headers.access_token, body, idem: req.headers['idempotency-key'] });
      const send = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
      if (behavior.fail?.(req)) return send(400, { errors: [{ code: 'invalid_action', description: 'Ação inválida.' }] });
      if (req.url === '/customers') return send(200, { id: 'cus_1' });
      if (req.url === '/payments' && req.method === 'POST') return send(200, { id: 'pay_1', status: 'PENDING', value: body.value ?? body.totalValue, netValue: behavior.netValue ?? 168.92, invoiceUrl: 'https://asaas.example/i/1' });
      if (req.url === '/lean/payments/pay_1' && req.method === 'PUT') return send(200, { id: 'pay_1' });
      if (req.url === '/payments/pay_1/pixQrCode') return send(200, { payload: '000201PIXDINAMICO', encodedImage: 'AAA', expirationDate: '2026-11-07 23:59:59' });
      if (req.url === '/payments/pay_1' && req.method === 'GET') return send(200, { id: 'pay_1', status: behavior.remoteStatus ?? 'RECEIVED' });
      if (req.url === '/payments/pay_1' && req.method === 'DELETE') return send(200, { deleted: true });
      if (req.url === '/payments/pay_1/refund') return send(200, { id: 'pay_1', status: 'REFUNDED' });
      if (req.url === '/accounts') return send(200, { id: 'acc_1', walletId: 'wallet_1', accessToken: { apiKey: 'chave-da-subconta' } });
      if (req.url === '/accounts/acc_1/escrow') return send(200, { enabled: true });
      if (req.url === '/myAccount/status/') return send(200, behavior.accountStatus ?? { general: 'APPROVED', commercialInfo: 'APPROVED', bankAccountInfo: 'APPROVED', documentation: 'APPROVED' });
      if (req.url === '/payments/pay_1/escrow') return send(200, { id: 'esc_1', status: behavior.escrowStatus ?? 'ACTIVE' });
      if (req.url === '/escrow/esc_1/finish') return send(200, {});
      return send(404, { errors: [{ description: 'rota desconhecida' }] });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  env.ASAAS_BASE_URL = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => { calls = []; behavior = {}; });

const provider = new AsaasProvider();
const amounts = computeCheckout({ serviceCents: 17000, clientFeePercent: 0, proCommissionPercent: 10 });
const charge = (extra = {}) => provider.createCharge({
  payment: { uuidText: 'uuid-1' }, order: { titleSnapshot: 'Instalação de chuveiro' }, method: 'pix', amounts, env,
  payer: { name: 'Ana Lima', cpfCnpj: '529.982.247-25', email: 'ana@exemplo.com', externalReference: 'user-1' }, receiver: { walletId: 'wallet_1' }, ...extra,
});

test('configuração: ambiente, URL base e chaves', () => {
  assert.equal(asaasBaseUrl({}), 'https://api-sandbox.asaas.com/v3');
  assert.equal(asaasBaseUrl({ ASAAS_ENV: 'production' }), 'https://api.asaas.com/v3');
  assert.equal(asaasBaseUrl({ ASAAS_BASE_URL: 'http://localhost:9/' }), 'http://localhost:9');
  assert.equal(asaasConfigured({ ASAAS_API_KEY: 'a', ASAAS_WEBHOOK_TOKEN: 'curto' }), false);
  assert.equal(asaasConfigured({ ASAAS_API_KEY: 'a', ASAAS_WEBHOOK_TOKEN: 'x'.repeat(32) }), true);
  assert.equal(asaasConfigured({ ASAAS_WEBHOOK_TOKEN: 'x'.repeat(32) }), false);
});

test('status do Asaas viram status internos', () => {
  assert.equal(ASAAS_STATUS.RECEIVED, 'confirmed');
  assert.equal(ASAAS_STATUS.CONFIRMED, 'confirmed');
  assert.equal(ASAAS_STATUS.OVERDUE, 'expired');
  assert.equal(ASAAS_STATUS.REFUNDED, 'refunded');
  assert.equal(ASAAS_STATUS.CHARGEBACK_REQUESTED, 'chargeback');
  assert.equal(mapAccountStatus({ general: 'APPROVED' }), 'approved');
  assert.equal(mapAccountStatus({ general: 'AWAITING_APPROVAL', documentation: 'PENDING' }), 'pending');
  assert.equal(mapAccountStatus({ general: 'PENDING', bankAccountInfo: 'REJECTED' }), 'rejected');
  assert.equal(mapAccountStatus({ general: 'REJECTED' }), 'rejected');
});

test('conta de recebimento: cria a subconta, guarda a chave e liga a garantia', async () => {
  const result = await provider.createReceivingAccount({
    name: 'Maria Silva', email: 'm@x.com', cpfCnpj: '529.982.247-25', mobilePhone: '(41) 99999-8888', incomeValue: 3000,
    address: 'Rua A', addressNumber: '10', province: 'Centro', postalCode: '80000-000', birthDate: '1990-01-01',
  }, { escrowDays: 14, env });
  assert.deepEqual(result, { accountId: 'acc_1', walletId: 'wallet_1', apiKey: 'chave-da-subconta', escrowEnabled: true });
  const create = calls.find((call) => call.path === '/accounts');
  assert.equal(create.key, 'chave-da-plataforma');
  assert.equal(create.body.cpfCnpj, '52998224725');
  assert.equal(create.body.postalCode, '80000000');
  assert.equal(create.body.mobilePhone, '41999998888');
  const escrow = calls.find((call) => call.path === '/accounts/acc_1/escrow');
  assert.deepEqual(escrow.body, { enabled: true, daysToExpire: 14, isFeePayer: false });
});

test('conta de recebimento: sem garantia a conta existe e o aviso fica para depois', async () => {
  behavior.fail = (req) => req.url.endsWith('/escrow');
  const result = await provider.createReceivingAccount({ name: 'M', email: 'm@x.com', cpfCnpj: '52998224725', mobilePhone: '41999998888', incomeValue: 1, address: 'R', addressNumber: '1', province: 'C', postalCode: '80000000' }, { escrowDays: 14, env });
  assert.equal(result.escrowEnabled, false);
  assert.equal(result.apiKey, 'chave-da-subconta');
});

test('situação cadastral é lida com a chave da própria subconta', async () => {
  behavior.accountStatus = { general: 'AWAITING_APPROVAL', commercialInfo: 'APPROVED', bankAccountInfo: 'PENDING', documentation: 'PENDING' };
  const result = await provider.getReceivingStatus('chave-da-subconta', { env });
  assert.equal(result.status, 'pending');
  assert.equal(calls[0].key, 'chave-da-subconta');
  assert.equal(result.detail.bankAccountInfo, 'PENDING');
});

test('Pix: cobrança com split e QR Code dinâmico; o profissional absorve a taxa do gateway', async () => {
  const result = await charge();
  const create = calls.find((call) => call.path === '/payments' && call.method === 'POST');
  assert.equal(create.body.billingType, 'PIX');
  assert.equal(create.body.value, 170);
  assert.deepEqual(create.body.split, [{ walletId: 'wallet_1', fixedValue: 153 }]);
  assert.equal(create.body.externalReference, 'uuid-1');
  assert.equal(create.idem, 'uuid-1');
  // líquido 168,92: a plataforma fica com 17,00 e o profissional com 151,92
  const update = calls.find((call) => call.path === '/lean/payments/pay_1');
  assert.deepEqual(update.body.split, [{ walletId: 'wallet_1', fixedValue: 151.92 }]);
  assert.equal(result.proShareCents, 15192);
  assert.equal(result.platformShareCents, 1700);
  assert.equal(result.pixPayload, '000201PIXDINAMICO');
  assert.ok(result.expiresAt instanceof Date && !Number.isNaN(result.expiresAt.getTime()));
  assert.equal(result.invoiceUrl, null);
  // o cliente é criado só com os dados necessários, e a chave usada é a da plataforma
  const customer = calls.find((call) => call.path === '/customers');
  assert.equal(customer.body.cpfCnpj, '52998224725');
  assert.ok(calls.every((call) => call.key === 'chave-da-plataforma'));
});

test('taxa do gateway paga pela plataforma: o split inicial já é o definitivo', async () => {
  const result = await charge({ gatewayFeePayer: 'platform' });
  assert.equal(calls.some((call) => call.path === '/lean/payments/pay_1'), false);
  assert.equal(result.proShareCents, 15300);
  assert.equal(result.platformShareCents, 1592);
});

test('cartão: usa a página hospedada do Asaas e parcela pelo valor total; nenhum dado de cartão trafega por aqui', async () => {
  const result = await charge({ method: 'credit_card', installments: 3 });
  const create = calls.find((call) => call.path === '/payments' && call.method === 'POST');
  assert.equal(create.body.billingType, 'CREDIT_CARD');
  assert.equal(create.body.installmentCount, 3);
  assert.equal(create.body.totalValue, 170);
  assert.equal(create.body.value, undefined);
  assert.equal(result.invoiceUrl, 'https://asaas.example/i/1');
  assert.equal(result.pixPayload, null);
  assert.ok(!JSON.stringify(calls).match(/creditCard|ccv|cardNumber/i));
  assert.equal(calls.some((call) => call.path.includes('pixQrCode')), false);
});

test('se não der para definir a divisão, a cobrança é cancelada (nunca fica com divisão errada)', async () => {
  behavior.fail = (req) => req.url === '/lean/payments/pay_1';
  await assert.rejects(() => charge(), (error) => error instanceof AsaasError);
  assert.ok(calls.some((call) => call.method === 'DELETE' && call.path === '/payments/pay_1'));
});

test('forma de pagamento desconhecida é recusada antes de falar com o gateway', async () => {
  await assert.rejects(() => charge({ method: 'bitcoin' }), (error) => error.status === 400);
  assert.equal(calls.length, 0);
});

test('consulta, cancelamento e estorno', async () => {
  const payment = { externalId: 'pay_1', amount: '170.00' };
  behavior.remoteStatus = 'CONFIRMED';
  assert.equal(await provider.getStatus(payment, { env }), 'confirmed');
  behavior.remoteStatus = 'OVERDUE';
  assert.equal(await provider.getStatus(payment, { env }), 'expired');
  assert.deepEqual(await provider.cancel(payment, { env }), { status: 'cancelled' });
  assert.deepEqual(await provider.refund(payment, { reason: 'Cancelado pelo cliente', env }), { status: 'refunded' });
  assert.deepEqual(calls.at(-1).body, { description: 'Cancelado pelo cliente' });
  assert.deepEqual(await provider.refund(payment, { cents: 8500, env }), { status: 'partially_refunded' });
  assert.equal(calls.at(-1).body.value, 85);
});

test('liberação da garantia usa a chave da subconta e não repete', async () => {
  const payment = { externalId: 'pay_1' };
  const first = await provider.releaseEscrow(payment, 'chave-da-subconta', { env });
  assert.deepEqual(first, { escrowId: 'esc_1', alreadyReleased: false });
  assert.equal(calls.find((call) => call.path === '/payments/pay_1/escrow').key, 'chave-da-subconta');
  assert.equal(calls.find((call) => call.path === '/escrow/esc_1/finish').key, 'chave-da-plataforma');
  calls = [];
  behavior.escrowStatus = 'DONE';
  const again = await provider.releaseEscrow(payment, 'chave-da-subconta', { env });
  assert.deepEqual(again, { escrowId: 'esc_1', alreadyReleased: true });
  assert.equal(calls.some((call) => call.path.endsWith('/finish')), false);
});

test('erros do gateway viram mensagens curtas e sem vazar chaves', async () => {
  behavior.fail = () => true;
  await assert.rejects(() => provider.cancel({ externalId: 'pay_1' }, { env }), (error) => error instanceof AsaasError && error.message === 'Ação inválida.' && !JSON.stringify(error).includes('chave-da-plataforma'));
  await assert.rejects(() => provider.cancel({ externalId: 'pay_1' }, { env: { ...env, ASAAS_API_KEY: '' } }), (error) => error.status === 503);
});

test('segredos cifrados: ida e volta, adulteração e chave ausente', () => {
  const secrets = { SECRETS_KEY: generateSecretsKey() };
  const sealed = encryptSecret('$aact_chave_da_subconta', secrets);
  assert.ok(sealed.startsWith('v1:') && !sealed.includes('aact'));
  assert.equal(decryptSecret(sealed, secrets), '$aact_chave_da_subconta');
  assert.notEqual(encryptSecret('x', secrets), encryptSecret('x', secrets));
  const parts = sealed.split(':');
  parts[3] = Buffer.from('adulterado').toString('base64');
  assert.throws(() => decryptSecret(parts.join(':'), secrets));
  assert.throws(() => decryptSecret(sealed, { SECRETS_KEY: generateSecretsKey() }));
  assert.throws(() => encryptSecret('x', {}), (error) => error.status === 503);
  assert.throws(() => encryptSecret('x', { SECRETS_KEY: 'curta' }), (error) => error.status === 503);
});
