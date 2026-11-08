// Seed de teste (SÓ desenvolvimento): cria pela API, com o prefixo "TESTE-", um conjunto de dados para os testes de navegador.
//   1 administrador, 3 clientes, 3 profissionais (A completo e com recebimento configurado, B incompleto, C sem serviço),
//   6 serviços com fotos, uma avaliação (pedido concluído de verdade) e favoritos.
// Recusa rodar contra qualquer coisa que não seja a API local de teste. Grava e2e/.seed.json com as contas criadas.
import fs from 'node:fs';
import path from 'node:path';
import { call, register, publishListing, nextWeekday, API, PW } from './lib/fixtures.mjs';
import { e2eDir, sql, DB_NAME } from './lib/env.mjs';

if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(API)) { console.error(`Recusado: o seed só roda contra a API local de teste (recebido: ${API}).`); process.exit(2); }
if (process.env.NODE_ENV === 'production') { console.error('Recusado: seed nunca roda em produção.'); process.exit(2); }
if (!/^dommos_teste/.test(DB_NAME)) { console.error('Recusado: banco fora do padrão dommos_teste.'); process.exit(2); }

const relogin = async (who) => { const l = await call('POST', '/auth/login', { email: who.email, password: PW }); who.token = l.d.token; who.user = l.d.user; return who; };
const slim = (who) => ({ email: who.email, uuid: who.uuid, name: who.user?.firstName });

const admin = await register('Admin');
sql(`INSERT IGNORE INTO roles (name) VALUES ('admin')`);
sql(`INSERT IGNORE INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.email='${admin.email}' AND r.name='admin'`);
const clients = [await register('Cliente1'), await register('Cliente2'), await register('Cliente3')];
const proA = await register('ProA'), proB = await register('ProB'), proC = await register('ProC');

// Profissional A: completo (4 serviços de modelos de preço diferentes) e com formas de receber.
const listings = {};
listings.a1 = await publishListing(proA, { pricing_model: 'fixed', price: 150, travel_fee: 20 }, 'TESTE-Instalação de chuveiro elétrico');
listings.a2 = await publishListing(proA, { pricing_model: 'hourly', price: 60 }, 'TESTE-Pintura de parede por hora');
listings.a3 = await publishListing(proA, { pricing_model: 'daily', price: 420 }, 'TESTE-Reforma de banheiro por diária');
listings.a4 = await publishListing(proA, { pricing_model: 'quote' }, 'TESTE-Projeto de cozinha sob consulta');
await relogin(proA);
const pay = await call('PUT', '/payments/receiving', { methods: ['pix', 'cash'], pix_key_type: 'email', pix_key: proA.email }, proA.token);
// Profissional B: perfil incompleto (sem forma de receber configurada: o pagamento fica bloqueado com aviso).
listings.b1 = await publishListing(proB, { pricing_model: 'fixed', price: 90, travel_fee: 0 }, 'TESTE-Limpeza de sofá');
listings.b2 = await publishListing(proB, { pricing_model: 'fixed', price: 200, travel_fee: 15 }, 'TESTE-Conserto de torneira');
await relogin(proB); await relogin(proC);

// Uma avaliação de verdade: pedido concluído pelo fluxo normal.
const date = nextWeekday(2, 4);
const order = await call('POST', '/orders', { listing_uuid: listings.a1.uuid, date, service_mode: 'remote' }, clients[0].token);
let reviewed = false;
if (order.s === 201) {
  const uuid = order.d.uuid;
  await call('POST', `/orders/${uuid}/accept`, null, proA.token);
  await call('POST', `/orders/${uuid}/start`, null, proA.token);
  const done = await call('POST', `/orders/${uuid}/complete`, { final_amount: 150 }, proA.token);
  if (done.s === 200) reviewed = (await call('POST', `/orders/${uuid}/reviews`, { rating: 5, comment: 'TESTE-Serviço excelente, pontual e caprichado.' }, clients[0].token)).s === 201;
}

// Favoritos.
const list1 = await call('POST', '/favorites/lists', { name: 'TESTE-Favoritos do cliente 1' }, clients[0].token);
await call('PUT', '/favorites/item', { type: 'listing', uuid: listings.a1.uuid, list_ids: [list1.d.id] }, clients[0].token);
await call('PUT', '/favorites/item', { type: 'listing', uuid: listings.b1.uuid, list_ids: [list1.d.id] }, clients[0].token);
const list2 = await call('POST', '/favorites/lists', { name: 'TESTE-Favoritos do cliente 2' }, clients[1].token);
await call('PUT', '/favorites/item', { type: 'listing', uuid: listings.a2.uuid, list_ids: [list2.d.id] }, clients[1].token);

const out = {
  password: PW, admin: slim(await relogin(admin)), clients: await Promise.all(clients.map(async (c) => slim(await relogin(c)))),
  pros: { a: slim(proA), b: slim(proB), c: slim(proC) }, listings: Object.fromEntries(Object.entries(listings).map(([key, value]) => [key, value.uuid])),
  reviewed, receivingConfigured: pay.s === 200,
};
fs.writeFileSync(path.join(e2eDir, '.seed.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok: true, anuncios: Object.keys(listings).length, avaliacao: reviewed, recebimentoA: out.receivingConfigured }));
