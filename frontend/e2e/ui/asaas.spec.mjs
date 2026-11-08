// C10–C13 pela interface, com o Asaas SIMULADO: Pix (QR e "copia e cola", a tela atualiza sozinha quando o aviso do gateway chega),
// cartão recusado (mensagem clara e nova tentativa), boleto, e aviso repetido que não duplica nada.
// O botão "Confirmar pagamento" do painel do sandbox real é manual (veja o RELATORIO-TESTE.md); aqui o próprio teste faz o
// papel do gateway, enviando o aviso (webhook) com o token de teste.
import { test, expect } from '@playwright/test';
import { startFakeAsaas } from '../lib/fake-asaas.mjs';
import { call, register, publishListing, nextWeekday } from '../lib/fixtures.mjs';
import { sql, API_URL } from '../lib/env.mjs';
import { watchProblems, expectNoHorizontalScroll, settle } from './helpers.mjs';

const TOKEN = process.env.E2E_ASAAS_WEBHOOK_TOKEN;
const CPF = '529.982.247-25';
const EXPECTED = [/status of 40[0-9]/i, /Failed to load resource.*(400|401|403|404|409|422)/i];
test.describe.configure({ mode: 'serial' });

let fake;
let eventSeq = 0;
test.beforeAll(async () => { fake = await startFakeAsaas({ port: 3200 }); });
test.afterAll(async () => { await fake?.close(); });

const webhook = (eventName, externalId) => fetch(`${API_URL}/payments/webhook/asaas`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN },
  body: JSON.stringify({ id: `evt_ui_${Date.now()}_${++eventSeq}`, event: eventName, payment: { id: externalId } }),
});
const externalIdOf = (orderUuid) => sql(`SELECT external_id FROM payments WHERE order_id=(SELECT id FROM orders WHERE uuid=UNHEX(REPLACE('${orderUuid}','-',''))) ORDER BY id DESC LIMIT 1`);

async function scenario(browser, offset) {
  // O nome do cadastro precisa ser único em cada cenário (o e-mail nasce dele).
  const unique = Math.random().toString(36).replace(/[0-9.]/g, '').slice(0, 6);
  const pro = await register(`AsaasPro${unique}`), cli = await register(`AsaasCli${unique}`);
  await publishListing(pro, { pricing_model: 'fixed', price: 99.99, travel_fee: 0 });
  const relogin = async (who) => { const l = await call('POST', '/auth/login', { email: who.email, password: 'senha-forte-1' }); who.token = l.d.token; who.user = l.d.user; };
  await relogin(pro); await relogin(cli);
  const listing = (await call('GET', `/listings/search?ownerUuid=${pro.user.uuid}`)).d.data[0].uuid;
  const created = await call('POST', '/payments/receiving-account', { name: 'Maria Silva', email: pro.email, cpf_cnpj: CPF, mobile_phone: '(41) 99999-8888', birth_date: '1990-01-01', income_value: 3000, address: 'Rua das Flores', address_number: '10', province: 'Centro', postal_code: '80000-000' }, pro.token);
  expect(created.s).toBe(201);
  fake.accountStatus.set([...fake.accountStatus.keys()].at(-1), 'APPROVED');
  const approved = await call('POST', '/payments/receiving-account/refresh', null, pro.token);
  expect(approved.d.canReceive).toBe(true);
  const order = await call('POST', '/orders', { listing_uuid: listing, date: nextWeekday(2, offset), service_mode: 'remote' }, cli.token);
  expect(order.s).toBe(201);
  await call('POST', `/orders/${order.d.uuid}/accept`, null, pro.token);
  const ctx = await browser.newContext();
  await ctx.addInitScript(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); }, [cli.token, JSON.stringify(cli.user)]);
  const page = await ctx.newPage();
  await page.goto(`contratacoes/${order.d.uuid}#pagamento`);
  await settle(page);
  return { page, ctx, order: order.d.uuid, pro, cli };
}

test('Pix: gera o QR e o copia e cola, e a tela vira "Pagamento confirmado" sozinha quando o aviso chega; aviso repetido não duplica', async ({ browser }, info) => {
  const { page, ctx, order } = await scenario(browser, info.project.name === '375' ? 9 : 16);
  const verify = watchProblems(page, { ignore: EXPECTED });
  await expect(page.getByRole('heading', { name: 'Pagamento' }).first()).toBeVisible();
  await expect(page.getByText('R$ 99,99').first()).toBeVisible();
  await page.getByLabel('Pix', { exact: false }).first().check();
  await page.getByLabel('CPF ou CNPJ de quem paga').fill('111.111.111-11');
  await page.getByRole('button', { name: 'Gerar Pix' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();                       // CPF inválido: mensagem clara
  await page.getByLabel('CPF ou CNPJ de quem paga').fill(CPF);
  await page.getByRole('button', { name: 'Gerar Pix' }).click();
  await expect(page.getByLabel('Pix copia e cola')).toHaveValue(/^00020126ASAAS/, { timeout: 20000 });
  await expect(page.getByText(/Este Pix expira em/)).toBeVisible();
  await expect(page.locator('main svg, main canvas, main img').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  // O "gateway" avisa que o Pix foi pago: a tela atualiza sozinha, sem recarregar.
  const externalId = externalIdOf(order);
  expect((await webhook('PAYMENT_RECEIVED', externalId)).status).toBe(200);
  await expect(page.getByText(/Pagamento confirmado: R\$\s*99,99/)).toBeVisible({ timeout: 30000 });
  // Aviso repetido: continua um único pagamento confirmado.
  expect((await webhook('PAYMENT_RECEIVED', externalId)).status).toBe(200);
  expect(sql(`SELECT COUNT(*) FROM payments WHERE external_id='${externalId}' AND status='confirmed'`)).toBe('1');
  // Conta em centavos: R$ 99,99 = comissão R$ 10,00 + profissional (menos a taxa do gateway do simulador).
  const split = sql(`SELECT CONCAT(amount_cents,'|',commission_cents,'|',pro_share_cents+platform_share_cents+gateway_fee_cents) FROM payments WHERE external_id='${externalId}'`).split('|').map(Number);
  expect(split[0]).toBe(9999);
  expect(split[1]).toBe(1000);
  expect(split[2]).toBe(9999);
  verify();
  await ctx.close();
});

test('cartão recusado: mensagem clara e é possível tentar de novo por outro meio', async ({ browser }, info) => {
  const { page, ctx, order } = await scenario(browser, info.project.name === '375' ? 10 : 17);
  const verify = watchProblems(page, { ignore: EXPECTED });
  await page.getByLabel('Cartão de crédito', { exact: false }).first().check();
  await page.getByLabel('CPF ou CNPJ de quem paga').fill(CPF);
  await page.getByRole('button', { name: 'Continuar para o pagamento' }).click();
  await expect(page.getByRole('link', { name: 'Pagar com cartão' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('link', { name: 'Pagar com cartão' })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('link', { name: 'Pagar com cartão' })).toHaveAttribute('rel', /noopener/);
  expect((await webhook('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', externalIdOf(order))).status).toBe(200);
  await expect(page.getByText(/foi recusado\. Tente outro meio de pagamento/)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Gerar Pix|Continuar para o pagamento/ })).toBeVisible();
  await expect(page.getByText(/número do cartão|CVV|validade do cartão/i)).toHaveCount(0);     // o Dommos nunca pede dados de cartão
  // Nova tentativa: Pix.
  await page.getByLabel('Pix', { exact: false }).first().check();
  await page.getByRole('button', { name: 'Gerar Pix' }).click();
  await expect(page.getByLabel('Pix copia e cola')).toHaveValue(/^00020126ASAAS/, { timeout: 20000 });
  verify();
  await ctx.close();
});

test('boleto: gera a cobrança com link seguro e confirma quando o aviso de compensação chega', async ({ browser }, info) => {
  const { page, ctx, order } = await scenario(browser, info.project.name === '375' ? 11 : 18);
  const verify = watchProblems(page, { ignore: EXPECTED });
  await page.getByLabel('Boleto', { exact: false }).first().check();
  await page.getByLabel('CPF ou CNPJ de quem paga').fill(CPF);
  await page.getByRole('button', { name: 'Continuar para o pagamento' }).click();
  await expect(page.getByRole('link', { name: 'Abrir boleto' })).toBeVisible({ timeout: 20000 });
  expect((await webhook('PAYMENT_CONFIRMED', externalIdOf(order))).status).toBe(200);
  await expect(page.getByText(/Pagamento confirmado: R\$\s*99,99/)).toBeVisible({ timeout: 30000 });
  await expectNoHorizontalScroll(page);
  verify();
  await ctx.close();
});

test('pedido de profissional sem recebimento aprovado: o pagamento fica bloqueado com mensagem clara', async ({ browser }, info) => {
  const tag = Math.random().toString(36).replace(/[0-9.]/g, '').slice(0, 6);
  const pro = await register(`AsaasSemRec${tag}`), cli = await register(`AsaasSemRecCli${tag}`);
  await publishListing(pro, { pricing_model: 'fixed', price: 120, travel_fee: 0 });
  const relogin = async (who) => { const l = await call('POST', '/auth/login', { email: who.email, password: 'senha-forte-1' }); who.token = l.d.token; who.user = l.d.user; };
  await relogin(pro); await relogin(cli);
  const listing = (await call('GET', `/listings/search?ownerUuid=${pro.user.uuid}`)).d.data[0].uuid;
  const order = await call('POST', '/orders', { listing_uuid: listing, date: nextWeekday(3, info.project.name === '375' ? 12 : 19), service_mode: 'remote' }, cli.token);
  await call('POST', `/orders/${order.d.uuid}/accept`, null, pro.token);
  const ctx = await browser.newContext();
  await ctx.addInitScript(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); }, [cli.token, JSON.stringify(cli.user)]);
  const page = await ctx.newPage();
  await page.goto(`contratacoes/${order.d.uuid}`);
  await settle(page);
  await expect(page.getByText(/liberando o recebimento|ainda não/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Gerar Pix|Continuar para o pagamento/ })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await ctx.close();
});
