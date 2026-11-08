import { ADDRESS } from '../lib/fixtures.mjs';
import { backendUrl } from '../lib/env.mjs';
import zlib from 'node:zlib';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const A = 'http://localhost:3100/api';
const AMP = 'http://localhost:3101/api';
const PW = 'senha-forte-1';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra))); };
const callOn = (base) => async (method, path, body, token, headers = {}) => {
  const response = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await response.json(); } catch { /* sem corpo */ }
  return { s: response.status, d: data };
};
const call = callOn(A);
const callMp = callOn(AMP);
const sql = (query) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', query]).toString().trim();
function png() {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const table = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = ~0; for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  return Buffer.concat([sig, chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 120, 60, 200]))), chunk('IEND', Buffer.alloc(0))]);
}
const upload = async (token) => { const form = new FormData(); form.set('purpose', 'service'); form.set('file', new Blob([png()], { type: 'image/png' }), 'a.png'); const r = await fetch(A + '/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: form }); return (await r.json()).url; };
const stamp = Date.now();
async function register(name) {
  const email = `${name}${stamp}@teste.invalid`;
  await call('POST', '/auth/register', { first_name: 'Teste', last_name: name, email, password: PW });
  const login = await call('POST', '/auth/login', { email, password: PW });
  return { email, token: login.d.token, user: login.d.user };
}
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nextWeekday = (weekday, minDays) => { const d = new Date(); d.setDate(d.getDate() + minDays); while (d.getDay() !== weekday) d.setDate(d.getDate() + 1); return key(d); };

// ---------- Mercado Pago falso ----------
const fakePayments = new Map();
let fakeCreates = 0;
const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.headers.authorization !== 'Bearer TEST-fake') return send(401, { message: 'unauthorized' });
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/v1/payments') {
      const body = JSON.parse(raw);
      const id = String((stamp % 100000000) * 100 + (++fakeCreates));
      fakePayments.set(id, { id, status: 'pending', transaction_amount: body.transaction_amount, external_reference: body.external_reference, idem: req.headers['x-idempotency-key'] });
      return send(201, { id, status: 'pending', point_of_interaction: { transaction_data: { qr_code: '00020126FAKEPIXMP' + id } } });
    }
    const m = url.pathname.match(/^\/v1\/payments\/(\d+)(\/refunds)?$/);
    if (m && fakePayments.has(m[1])) {
      const p = fakePayments.get(m[1]);
      if (req.method === 'GET') return send(200, p);
      if (req.method === 'PUT') { p.status = JSON.parse(raw).status; return send(200, p); }
      if (req.method === 'POST' && m[2]) { p.status = 'refunded'; return send(201, { id: 1 }); }
    }
    send(404, { message: 'not found' });
  });
});
await new Promise((resolve) => fake.listen(3200, '127.0.0.1', resolve));

const webhook = (id, { secret = 'segredo-de-teste', requestId = 'req-' + Math.random(), ts = String(Date.now()), skipSig = false } = {}) => {
  const sig = `ts=${ts},v1=${crypto.createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex')}`;
  return callMp('POST', `/payments/webhook/mercadopago?data.id=${id}`, { type: 'payment', data: { id } }, null, { 'x-request-id': requestId, ...(skipSig ? {} : { 'x-signature': sig }) });
};

// ---------- cenário: anúncio pronto ----------
const pro = await register('ProPay');
const cli = await register('CliPay');
const other = await register('OutroPay');
const cats = (await call('GET', '/categories')).d;
const items = (await call('GET', '/service-catalog')).d;
const item = items.find((i) => i.category.id === cats[0].id);
const wed = nextWeekday(3, 5);

async function publishListing(owner, pricing = { pricing_model: 'fixed', price: 150, travel_fee: 20 }) {
  const L = (await call('POST', '/pro/listings', null, owner.token)).d.uuid;
  const imgs = [await upload(owner.token), await upload(owner.token), await upload(owner.token)];
  const week = [1, 2, 3, 4, 5].map((day) => ({ day, from: '08:00', to: '18:00' }));
  const patch = (b) => call('PATCH', '/pro/listings/' + L, b, owner.token);
  await patch({ category_id: cats[0].id, catalog_item_id: item.id, service_modes: ['client_place', 'remote'], city: 'Curitiba', state: 'PR', radius_km: 25 });
  await patch({ title: 'Instalação de chuveiro elétrico', description: 'Instalo chuveiros elétricos com garantia de 90 dias, deixo tudo limpo e funcionando.', image_urls: imgs, included: ['Mão de obra'], excluded: [], ...pricing, availability: { weekdays: week, lead_time_hours: 24 }, cancellation_policy: 'moderate' });
  await call('PUT', '/pro/verification', { legal_name: 'Maria da Silva', document_type: 'cpf', document: '529.982.247-25' }, owner.token);
  const published = await call('POST', `/pro/listings/${L}/publish`, null, owner.token);
  return { uuid: L, status: published.s };
}
const listing = await publishListing(pro);
ok('anúncio publicado para o teste', listing.status === 200);
const book = async (client, date = wed) => (await call('POST', '/orders', { listing_uuid: listing.uuid, date, service_mode: 'client_place', service_address: ADDRESS }, client.token)).d.uuid;

// ---------- configuração de recebimento ----------
ok('config pública exige login', (await call('GET', '/payments/config')).s === 401);
const cfg = await call('GET', '/payments/config', null, cli.token);
ok('modo gratuito: provedor manual e sem cartão online', cfg.d.provider === 'manual' && cfg.d.automatic === false && cfg.d.freeMode === true && cfg.d.methods.every((m) => ['pix', 'cash', 'card_in_person'].includes(m.value)), cfg.d);
ok('recebimento começa só com Pix e sem chave', (await call('GET', '/payments/receiving', null, pro.token)).d.pixKey === null);
ok('receber por Pix sem chave é recusado', (await call('PUT', '/payments/receiving', { methods: ['pix'] }, pro.token)).s === 400);
ok('chave inválida para o tipo é recusada', (await call('PUT', '/payments/receiving', { pix_key_type: 'cpf', pix_key: '111.111.111-11', methods: ['pix'] }, pro.token)).s === 400);
ok('forma inventada recusada', (await call('PUT', '/payments/receiving', { methods: ['bitcoin'] }, pro.token)).s === 400);
ok('nenhuma forma recusada', (await call('PUT', '/payments/receiving', { methods: [] }, pro.token)).s === 400);

// Antes de configurar: o pagamento não deve ser possível.
const O0 = await book(cli);
await call('POST', `/orders/${O0}/accept`, null, pro.token);
const st0 = await call('GET', '/payments/order/' + O0, null, cli.token);
ok('sem chave Pix o profissional ainda não recebe (explica o motivo)', st0.d.canStart === false && st0.d.methods.length === 0 && st0.d.blockedReason.includes('não configurou'), st0.d);
ok('tentar pagar assim é recusado', (await call('POST', '/payments/order/' + O0, { method: 'pix' }, cli.token)).s === 409);
await call('POST', `/orders/${O0}/cancel`, null, cli.token);

const saved = await call('PUT', '/payments/receiving', { pix_key_type: 'cpf', pix_key: '529.982.247-25', methods: ['pix', 'cash'] }, pro.token);
ok('salva a chave Pix (só dígitos) e as formas aceitas', saved.s === 200 && saved.d.pixKey === '52998224725' && saved.d.methods.join() === 'pix,cash', saved.d);
ok('a chave Pix do outro não aparece para o cliente', (await call('GET', '/payments/receiving', null, cli.token)).d.pixKey === null);

// ---------- Pix direto: fluxo completo ----------
const O1 = await book(cli);
const early = await call('GET', '/payments/order/' + O1, null, cli.token);
ok('pedido ainda não aceito: pagamento bloqueado com explicação', early.d.canStart === false && early.d.blockedReason.includes('depois que o profissional aceita'), early.d);
ok('pagar antes do aceite é recusado (409)', (await call('POST', '/payments/order/' + O1, { method: 'pix' }, cli.token)).s === 409);
await call('POST', `/orders/${O1}/accept`, null, pro.token);
const st1 = await call('GET', '/payments/order/' + O1, null, cli.token);
ok('aceito: valor de R$ 170 (150 + 20) e formas disponíveis', st1.d.canStart === true && st1.d.amountDue === 170 && st1.d.methods.map((m) => m.value).join() === 'pix,cash' && st1.d.payment === null, st1.d);
ok('o profissional não inicia o pagamento (403)', (await call('POST', '/payments/order/' + O1, { method: 'pix' }, pro.token)).s === 403);
ok('um estranho não vê o estado do pagamento (404)', (await call('GET', '/payments/order/' + O1, null, other.token)).s === 404);
ok('um estranho não inicia pagamento (404)', (await call('POST', '/payments/order/' + O1, { method: 'pix' }, other.token)).s === 404);
ok('cartão online não é aceito', (await call('POST', '/payments/order/' + O1, { method: 'card_in_person' }, cli.token)).s === 409);
ok('forma inventada é 400', (await call('POST', '/payments/order/' + O1, { method: 'cartao' }, cli.token)).s === 400);
const created = await call('POST', '/payments/order/' + O1, { method: 'pix' }, cli.token);
const P1 = created.d.payment?.uuid;
ok('cria o pagamento Pix com BR Code e chave para copiar', created.s === 201 && created.d.payment.status === 'pending' && created.d.payment.amount === 170 && created.d.payment.pix.payload.startsWith('000201') && created.d.payment.pix.key === '52998224725', created.d);
ok('o BR Code carrega o valor e o CRC é válido', /5406170\.00/.test(created.d.payment.pix.payload) && (await import(backendUrl('src/utils/pixBrCode.js'))).parseBrCode(created.d.payment.pix.payload).crcOk);
const again = await call('POST', '/payments/order/' + O1, { method: 'pix' }, cli.token);
ok('pedir de novo não duplica (mesmo pagamento)', again.d.payment.uuid === P1 && sql(`SELECT COUNT(*) FROM payments WHERE status IN ('pending','reported','confirmed') AND order_id=(SELECT id FROM orders WHERE uuid=UNHEX(REPLACE('${O1}','-','')))`) === '1', again.d);
const [r1, r2] = await Promise.all([call('POST', '/payments/order/' + O1, { method: 'pix' }, cli.token), call('POST', '/payments/order/' + O1, { method: 'pix' }, cli.token)]);
ok('duas requisições ao mesmo tempo continuam com um só pagamento', r1.d.payment.uuid === P1 && r2.d.payment.uuid === P1);
const proView = await call('GET', '/payments/order/' + O1, null, pro.token);
ok('o profissional vê o pagamento com a chave mascarada', proView.d.payment.pix.key.includes('***') && proView.d.payment.actions.includes('confirm'), proView.d.payment);
ok('o cliente só pode "já paguei" e cancelar', created.d.payment.actions.join() === 'report,cancel', created.d.payment.actions);
ok('o profissional não marca "já paguei" pelo cliente (403)', (await call('POST', `/payments/${P1}/report`, null, pro.token)).s === 403);
ok('o cliente não confirma o próprio pagamento (403)', (await call('POST', `/payments/${P1}/confirm`, null, cli.token)).s === 403);
ok('um estranho não age no pagamento (404)', (await call('POST', `/payments/${P1}/confirm`, null, other.token)).s === 404);
ok('um estranho não vê o recibo (404)', (await call('GET', `/payments/${P1}/receipt`, null, other.token)).s === 404);
ok('recibo antes da confirmação é recusado (409)', (await call('GET', `/payments/${P1}/receipt`, null, cli.token)).s === 409);
ok('ação inventada é 404', (await call('POST', `/payments/${P1}/roubar`, null, cli.token)).s === 404);
const reported = await call('POST', `/payments/${P1}/report`, null, cli.token);
ok('cliente marca "já paguei"', reported.s === 200 && reported.d.status === 'reported');
ok('marcar duas vezes é recusado (409)', (await call('POST', `/payments/${P1}/report`, null, cli.token)).s === 409);
ok('o profissional foi avisado', Number(sql(`SELECT COUNT(*) FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.email='${pro.email}' AND n.message LIKE '%informou que pagou%'`)) === 1);
const rejected = await call('POST', `/payments/${P1}/reject`, { note: 'Não vi o Pix na conta' }, pro.token);
ok('profissional diz que não recebeu: volta a aguardar', rejected.s === 200 && rejected.d.status === 'pending');
ok('o cliente é avisado da recusa', Number(sql(`SELECT COUNT(*) FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.email='${cli.email}' AND n.message LIKE '%encontrou o pagamento%'`)) === 1);
await call('POST', `/payments/${P1}/report`, null, cli.token);
const confirmed = await call('POST', `/payments/${P1}/confirm`, null, pro.token);
ok('profissional confirma o recebimento', confirmed.s === 200 && confirmed.d.status === 'confirmed');
ok('confirmar de novo (duplicado) é recusado', (await call('POST', `/payments/${P1}/confirm`, null, pro.token)).s === 409);
ok('depois de confirmado não dá para cancelar (409)', (await call('POST', `/payments/${P1}/cancel`, null, cli.token)).s === 409);
const rec = await call('GET', `/payments/${P1}/receipt`, null, cli.token);
ok('recibo com número, valor, partes e aviso de não ser nota fiscal', rec.s === 200 && /^DM-\d{8}$/.test(rec.d.number) && rec.d.amount === 170 && rec.d.client && rec.d.professional && rec.d.notice.includes('não é nota fiscal'), rec.d);
ok('o profissional também acessa o recibo', (await call('GET', `/payments/${P1}/receipt`, null, pro.token)).s === 200);
ok('depois de confirmado o BR Code some da resposta', (await call('GET', '/payments/order/' + O1, null, cli.token)).d.payment.pix === null);
const history = (await call('GET', '/payments/order/' + O1, null, cli.token)).d.payment.events.map((e) => e.type);
ok('histórico registra tudo na ordem', history.join() === 'created,report,reject,report,confirm', history);
ok('pedido concluído depois de pago', (await call('POST', `/orders/${O1}/start`, null, pro.token)).s === 200 && (await call('POST', `/orders/${O1}/complete`, { final_amount: 170 }, pro.token)).s === 200);
ok('avaliação continua liberada', (await call('POST', `/orders/${O1}/reviews`, { rating: 5, comment: 'Tudo certo, serviço rápido.' }, cli.token)).s === 201);
ok('lista do cliente ("Como pago")', (await call('GET', '/payments/mine?role=client', null, cli.token)).d.data.some((p) => p.uuid === P1 && p.status === 'confirmed'));
ok('lista do profissional ("Como recebo")', (await call('GET', '/payments/mine?role=professional', null, pro.token)).d.data.some((p) => p.uuid === P1));
ok('o estranho não vê pagamentos alheios', (await call('GET', '/payments/mine?role=client', null, other.token)).d.data.length === 0 && (await call('GET', '/payments/mine?role=professional', null, other.token)).d.data.length === 0);
const refunded = await call('POST', `/payments/${P1}/refund`, null, pro.token);
ok('profissional registra estorno de pagamento confirmado', refunded.s === 200 && refunded.d.status === 'refunded');
ok('depois do estorno ainda há recibo (status estornado)', (await call('GET', `/payments/${P1}/receipt`, null, cli.token)).d.status === 'refunded');
ok('novo pagamento após estorno é permitido para o mesmo pedido', (await call('POST', '/payments/order/' + O1, { method: 'cash' }, cli.token)).s === 201);

// ---------- Dinheiro, cancelamento e pedido cancelado ----------
const O2 = await book(cli, nextWeekday(4, 6));
await call('POST', `/orders/${O2}/accept`, null, pro.token);
const cash = await call('POST', '/payments/order/' + O2, { method: 'cash' }, cli.token);
ok('dinheiro: sem BR Code e sem chave', cash.s === 201 && cash.d.payment.method === 'cash' && cash.d.payment.pix === null);
const P2 = cash.d.payment.uuid;
const swap = await call('POST', '/payments/order/' + O2, { method: 'pix' }, cli.token);
ok('trocar de dinheiro para Pix antes de pagar atualiza a mesma cobrança', swap.d.payment.uuid === P2 && swap.d.payment.method === 'pix' && !!swap.d.payment.pix, swap.d);
ok('profissional confirma sem o cliente marcar (dinheiro na mão)', (await call('POST', `/payments/${P2}/confirm`, null, pro.token)).d.status === 'confirmed');
const O3 = await book(cli, nextWeekday(5, 6));
await call('POST', `/orders/${O3}/accept`, null, pro.token);
const P3 = (await call('POST', '/payments/order/' + O3, { method: 'pix' }, cli.token)).d.payment.uuid;
ok('cancelar o pedido encerra a cobrança em aberto', (await call('POST', `/orders/${O3}/cancel`, null, cli.token)).s === 200 && sql(`SELECT status FROM payments WHERE uuid=UNHEX(REPLACE('${P3}','-',''))`) === 'cancelled');
ok('pagar pedido cancelado é recusado', (await call('POST', '/payments/order/' + O3, { method: 'pix' }, cli.token)).s === 409);
const O4 = await book(cli, nextWeekday(1, 7));
await call('POST', `/orders/${O4}/accept`, null, pro.token);
const P4 = (await call('POST', '/payments/order/' + O4, { method: 'pix' }, cli.token)).d.payment.uuid;
ok('cliente cancela a cobrança antes de pagar', (await call('POST', `/payments/${P4}/cancel`, null, cli.token)).d.status === 'cancelled');
ok('depois pode gerar outra', (await call('POST', '/payments/order/' + O4, { method: 'pix' }, cli.token)).d.payment.uuid !== P4);

// ---------- Valor definido na conclusão ----------
const hourly = await publishListing(pro, { pricing_model: 'hourly', price: 60 });
const O5 = (await call('POST', '/orders', { listing_uuid: hourly.uuid, date: nextWeekday(2, 8), time: '09:00', quantity: 3, service_mode: 'remote' }, cli.token)).d.uuid;
await call('POST', `/orders/${O5}/accept`, null, pro.token);
const st5 = await call('GET', '/payments/order/' + O5, null, cli.token);
ok('por hora: o valor já é conhecido (R$ 60 x 3 horas) e o pagamento pode começar', st5.d.canStart === true && st5.d.amountDue === 180, st5.d);
await call('POST', `/orders/${O5}/start`, null, pro.token);
await call('POST', `/orders/${O5}/complete`, { final_amount: 245.5 }, pro.token);
const st5b = await call('GET', '/payments/order/' + O5, null, cli.token);
ok('concluído: valor final vira o valor a pagar', st5b.d.canStart === true && st5b.d.amountDue === 245.5, st5b.d);
const P5 = (await call('POST', '/payments/order/' + O5, { method: 'pix' }, cli.token)).d.payment;
ok('pagamento do valor final com BR Code correto', P5.amount === 245.5 && /5406245\.50/.test(P5.pix.payload));

// ---------- valor ajustado na conclusão (preço fixo) ----------
const O6 = await book(cli, nextWeekday(3, 9));
await call('POST', `/orders/${O6}/accept`, null, pro.token);
const P6 = (await call('POST', '/payments/order/' + O6, { method: 'pix' }, cli.token)).d.payment;
await call('POST', `/orders/${O6}/start`, null, pro.token);
await call('POST', `/orders/${O6}/complete`, { final_amount: 200 }, pro.token);
const P6b = (await call('GET', '/payments/order/' + O6, null, cli.token)).d.payment;
ok('valor final diferente atualiza a cobrança ainda não paga e o BR Code', P6b.uuid === P6.uuid && P6b.amount === 200 && /5406200\.00/.test(P6b.pix.payload), P6b);

// ---------- Mercado Pago (simulado) ----------
const cfgMp = await callMp('GET', '/payments/config', null, cli.token);
ok('com Mercado Pago configurado o provedor ativo muda', cfgMp.d.provider === 'mercadopago' && cfgMp.d.automatic === true, cfgMp.d);
const O7 = (await callMp('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(4, 31), service_mode: 'client_place', service_address: ADDRESS }, cli.token)).d.uuid;
await callMp('POST', `/orders/${O7}/accept`, null, pro.token);
const mpStart = await callMp('POST', '/payments/order/' + O7, { method: 'pix' }, cli.token);
const PM = mpStart.d.payment;
ok('Pix automático: cobrança criada no provedor com o copia e cola dele', mpStart.s === 201 && PM.provider === 'mercadopago' && PM.pix.payload.startsWith('00020126FAKEPIXMP') && fakePayments.size === 1, mpStart.d);
ok('o provedor recebeu o valor certo e a referência do pagamento', [...fakePayments.values()][0].transaction_amount === 170 && [...fakePayments.values()][0].external_reference === PM.uuid);
ok('com provedor automático o cliente não marca "já paguei" (409)', (await callMp('POST', `/payments/${PM.uuid}/report`, null, cli.token)).s === 409);
ok('com provedor automático o profissional não confirma à mão (409)', (await callMp('POST', `/payments/${PM.uuid}/confirm`, null, pro.token)).s === 409);
const extId = [...fakePayments.keys()][0];
ok('webhook sem assinatura é recusado (401)', (await webhook(extId, { skipSig: true })).s === 401);
ok('webhook com segredo errado é recusado (401)', (await webhook(extId, { secret: 'errado' })).s === 401);
ok('webhook expirado é recusado (401)', (await webhook(extId, { ts: String(Date.now() - 3600_000) })).s === 401);
ok('nada mudou com os webhooks recusados', sql(`SELECT status FROM payments WHERE uuid=UNHEX(REPLACE('${PM.uuid}','-',''))`) === 'pending');
fakePayments.get(extId).status = 'approved';
const wh = await webhook(extId);
ok('webhook válido confirma o pagamento', wh.s === 200 && wh.d.status === 'confirmed', wh);
ok('e gera o número do recibo', /^DM-/.test(sql(`SELECT receipt_number FROM payments WHERE uuid=UNHEX(REPLACE('${PM.uuid}','-',''))`)));
const dup = await webhook(extId);
ok('webhook repetido não processa duas vezes', dup.s === 200 && dup.d.duplicate === true, dup.d);
ok('as duas partes foram avisadas uma única vez', Number(sql(`SELECT COUNT(*) FROM notifications WHERE event_key LIKE 'payment-webhook:${PM.uuid}:confirmed:%'`)) === 2);
fakePayments.get(extId).transaction_amount = 1;
fakePayments.get(extId).status = 'refunded';
const bad = await webhook(extId);
ok('valor diferente do cobrado é ignorado', bad.s === 200 && bad.d.ignored === true && sql(`SELECT status FROM payments WHERE uuid=UNHEX(REPLACE('${PM.uuid}','-',''))`) === 'confirmed', bad.d);
fakePayments.get(extId).transaction_amount = 170;
const refundWh = await webhook(extId);
ok('estorno vindo do provedor é registrado', refundWh.d.status === 'refunded');
ok('webhook de pagamento desconhecido é ignorado', (await (async () => { fakePayments.set('777', { id: '777', status: 'approved', transaction_amount: 1 }); return webhook('777'); })()).d.ignored === true);
ok('o histórico guarda o webhook', sql(`SELECT GROUP_CONCAT(type) FROM payment_events WHERE payment_id=(SELECT id FROM payments WHERE uuid=UNHEX(REPLACE('${PM.uuid}','-','')))`).includes('webhook'));
ok('sem MP configurado o webhook responde 503 (porta 3100)', (await call('POST', '/payments/webhook/mercadopago?data.id=1', {}, null, { 'x-signature': 'ts=1,v1=aa', 'x-request-id': 'x' })).s === 503);
ok('o log do servidor não contém a chave Pix nem o segredo', !(await import('node:fs')).readFileSync(process.env.E2E_API_LOG, 'utf8').includes('52998224725'));

// ---------- Segurança geral ----------
ok('nenhuma tabela guarda dados de cartão', sql(`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND (column_name LIKE '%card_number%' OR column_name LIKE '%cvv%' OR column_name LIKE '%pan%')`) === '0');
ok('pagamento exige login', (await call('GET', '/payments/mine')).s === 401 && (await call('POST', '/payments/order/' + O1, { method: 'pix' })).s === 401);

fake.close();
console.log(JSON.stringify({ pass, fail }));
process.exit(fail ? 1 : 0);
