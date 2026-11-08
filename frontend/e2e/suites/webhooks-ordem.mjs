// C13: avisos do gateway fora de ordem, repetidos, de cobrança desconhecida e de tipo desconhecido. O estado do pagamento nunca anda para trás
// e nenhum aviso estranho derruba a API. Roda com a API no modo Asaas e o Asaas simulado.
import { startFakeAsaas } from '../lib/fake-asaas.mjs';
import { call, register, publishListing, nextWeekday, stamp, API } from '../lib/fixtures.mjs';
import { sql } from '../lib/env.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };
const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const CPF = '529.982.247-25';
const fake = await startFakeAsaas({ port: 3200, seed: stamp });
let seq = 0;
const webhook = async (name, externalId, token = TOKEN, extra = {}) => {
  const response = await fetch(`${API}/payments/webhook/asaas`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token && { 'asaas-access-token': token }) }, body: JSON.stringify({ id: `evt_ord_${stamp}_${++seq}`, event: name, payment: { id: externalId }, ...extra }) });
  return { s: response.status, d: await response.json().catch(() => null) };
};
const relogin = async (who) => { const l = await call('POST', '/auth/login', { email: who.email, password: 'senha-forte-1' }); who.token = l.d.token; who.user = l.d.user; };

const pro = await register('OrdPro'), cli = await register('OrdCli');
await publishListing(pro, { pricing_model: 'fixed', price: 99.99, travel_fee: 0 });
await relogin(pro); await relogin(cli);
const listing = (await call('GET', `/listings/search?ownerUuid=${pro.user.uuid}`)).d.data[0].uuid;
await call('POST', '/payments/receiving-account', { name: 'Maria Silva', email: pro.email, cpf_cnpj: CPF, mobile_phone: '(41) 99999-8888', birth_date: '1990-01-01', income_value: 3000, address: 'Rua das Flores', address_number: '10', province: 'Centro', postal_code: '80000-000' }, pro.token);
fake.accountStatus.set([...fake.accountStatus.keys()].at(-1), 'APPROVED');
await call('POST', '/payments/receiving-account/refresh', null, pro.token);
let day = 6;
const newPaid = async () => {
  const order = (await call('POST', '/orders', { listing_uuid: listing, date: nextWeekday(1 + (day % 5), day), service_mode: 'remote' }, cli.token)).d.uuid; day += 3;
  await call('POST', `/orders/${order}/accept`, null, pro.token);
  const payment = (await call('POST', '/payments/order/' + order, { method: 'pix', cpf_cnpj: CPF }, cli.token)).d.payment;
  return { order, uuid: payment.uuid, external: sql(`SELECT external_id FROM payments WHERE uuid=UNHEX(REPLACE('${payment.uuid}','-',''))`) };
};
const status = (uuid) => sql(`SELECT status FROM payments WHERE uuid=UNHEX(REPLACE('${uuid}','-',''))`);

// 1) Pago e depois chega um aviso de "vencido" atrasado (fora de ordem): continua pago.
const paid = await newPaid();
ok('cobrança nasce pendente', status(paid.uuid) === 'pending');
ok('pagamento confirmado pelo aviso', (await webhook('PAYMENT_RECEIVED', paid.external)).s === 200 && status(paid.uuid) === 'confirmed');
const late = await webhook('PAYMENT_OVERDUE', paid.external);
ok('aviso de "vencido" depois de pago é aceito sem efeito (200) e o pagamento continua confirmado', late.s === 200 && status(paid.uuid) === 'confirmed', late);
ok('aviso de "recusado" depois de pago também não desfaz', (await webhook('PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', paid.external)).s === 200 && status(paid.uuid) === 'confirmed');
ok('um único pagamento confirmado, nunca duplicado', sql(`SELECT COUNT(*) FROM payments WHERE external_id='${paid.external}'`) === '1');

// 2) Estornado e depois chega "confirmado" atrasado: continua estornado.
const refunded = await newPaid();
await webhook('PAYMENT_RECEIVED', refunded.external);
await webhook('PAYMENT_REFUNDED', refunded.external);
ok('estorno registrado', status(refunded.uuid) === 'refunded');
ok('"confirmado" atrasado depois do estorno não reabre o pagamento', (await webhook('PAYMENT_CONFIRMED', refunded.external)).s === 200 && status(refunded.uuid) === 'refunded');

// 3) Avisos que não deveriam existir não derrubam nada.
ok('cobrança desconhecida: 200 e nada quebra', (await webhook('PAYMENT_RECEIVED', 'pay_que_nao_existe')).s === 200);
ok('tipo de aviso desconhecido: 200 (ignorado)', (await webhook('PAYMENT_ALGO_NOVO_DO_GATEWAY', paid.external)).s === 200);
ok('corpo sem "payment": não derruba (4xx, nunca 500)', (await fetch(`${API}/payments/webhook/asaas`, { method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN }, body: JSON.stringify({ id: `evt_x_${stamp}`, event: 'PAYMENT_RECEIVED' }) })).status < 500);
ok('corpo que não é JSON não derruba (4xx, nunca 500)', (await fetch(`${API}/payments/webhook/asaas`, { method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN }, body: '{isto não é json' })).status < 500);
ok('token ausente: 401', (await webhook('PAYMENT_RECEIVED', paid.external, null)).s === 401);
ok('token errado: 401 e nada muda', (await webhook('PAYMENT_REFUNDED', paid.external, 'token-errado')).s === 401 && status(paid.uuid) === 'confirmed');

// 4) Mesmo aviso (mesmo id) duas vezes ao mesmo tempo: processado uma vez.
const race = await newPaid();
const same = { id: `evt_dup_${stamp}`, event: 'PAYMENT_RECEIVED', payment: { id: race.external } };
const both = await Promise.all([1, 2].map(() => fetch(`${API}/payments/webhook/asaas`, { method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN }, body: JSON.stringify(same) }).then((r) => r.status)));
ok('o mesmo aviso em paralelo responde 200 nas duas vezes', both.every((code) => code === 200), both);
ok('e é registrado uma única vez', sql(`SELECT COUNT(*) FROM webhook_events WHERE event_key='evt_dup_${stamp}'`) === '1');
ok('a API segue de pé depois de tudo isso', (await fetch(API.replace(/\/api$/, '/health'))).ok);

await fake.close();
console.log(JSON.stringify({ pass, fail }));
process.exitCode = fail ? 1 : 0;
