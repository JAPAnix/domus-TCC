import { call, register, publishListing, nextWeekday, API, PW, ADDRESS } from '../lib/fixtures.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra))); };

const pro = await register('ProSec');
const cli = await register('CliSec');
const evil = await register('EvilSec');
const listing = await publishListing(pro);
await call('PUT', '/payments/receiving', { pix_key_type: 'cpf', pix_key: '529.982.247-25', methods: ['pix'] }, pro.token);
const order = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(2, 5), service_mode: 'client_place', service_address: ADDRESS }, cli.token)).d.uuid;
await call('POST', `/orders/${order}/accept`, null, pro.token);
const payment = (await call('POST', '/payments/order/' + order, { method: 'pix' }, cli.token)).d.payment.uuid;
const conv = (await call('POST', '/conversations', { listing_uuid: listing.uuid }, cli.token)).d.uuid;
await call('POST', `/conversations/${conv}/messages`, { body: 'segredo do cliente' }, cli.token);
const reply = (await call('POST', '/quick-replies', { title: 'Meu modelo', body: 'texto' }, pro.token)).d.id;
const favList = (await call('POST', '/favorites/lists', { name: 'Privada' }, cli.token)).d.id;
const bogus = '00000000-0000-4000-8000-000000000000';

// ---------- sem login ----------
const protectedRoutes = [
  ['GET', '/orders/mine'], ['GET', '/orders/' + order], ['POST', `/orders/${order}/accept`], ['GET', '/payments/mine'], ['GET', '/payments/order/' + order],
  ['POST', `/payments/${payment}/confirm`], ['GET', `/payments/${payment}/receipt`], ['GET', '/conversations'], ['GET', '/conversations/' + conv], ['POST', `/conversations/${conv}/messages`],
  ['GET', '/quick-replies'], ['GET', '/pro/listings'], ['GET', '/pro/summary'], ['GET', '/favorites'], ['GET', '/settings'], ['GET', '/account/sessions'], ['GET', '/notifications'],
  ['GET', '/blocks'], ['PUT', '/payments/receiving'], ['POST', '/uploads'], ['GET', '/professionals/dashboard'], ['POST', '/feedback'],
];
const anon = await Promise.all(protectedRoutes.map(([m, p]) => call(m, p)));
ok('todas as rotas privadas exigem login (401)', anon.every((r) => r.s === 401), anon.map((r, i) => [protectedRoutes[i][1], r.s]).filter(([, s]) => s !== 401));

// ---------- um usuário não mexe nos dados de outro ----------
const probes = [
  ['pedido', 'GET', '/orders/' + order], ['aceitar pedido', 'POST', `/orders/${order}/accept`], ['cancelar pedido', 'POST', `/orders/${order}/cancel`], ['avaliar pedido', 'POST', `/orders/${order}/reviews`, { rating: 1, comment: 'ruim demais aqui' }],
  ['estado do pagamento', 'GET', '/payments/order/' + order], ['iniciar pagamento', 'POST', '/payments/order/' + order, { method: 'pix' }], ['confirmar pagamento', 'POST', `/payments/${payment}/confirm`], ['cancelar pagamento', 'POST', `/payments/${payment}/cancel`], ['estornar', 'POST', `/payments/${payment}/refund`], ['recibo', 'GET', `/payments/${payment}/receipt`],
  ['conversa', 'GET', '/conversations/' + conv], ['enviar mensagem', 'POST', `/conversations/${conv}/messages`, { body: 'invasor' }], ['ler', 'POST', `/conversations/${conv}/read`], ['arquivar', 'POST', `/conversations/${conv}/archive`], ['denunciar', 'POST', `/conversations/${conv}/report`, { reason: 'spam' }], ['respostas da conversa', 'GET', `/conversations/${conv}/replies`],
  ['editar modelo', 'PUT', '/quick-replies/' + reply, { title: 'x', body: 'y' }], ['apagar modelo', 'DELETE', '/quick-replies/' + reply],
  ['ver anúncio em rascunho do dono', 'GET', '/pro/listings/' + listing.uuid], ['editar anúncio', 'PATCH', '/pro/listings/' + listing.uuid, { title: 'invadido pelo outro' }], ['apagar anúncio', 'DELETE', '/pro/listings/' + listing.uuid], ['pausar anúncio', 'POST', `/pro/listings/${listing.uuid}/pause`],
  ['lista de favoritos', 'GET', '/favorites/lists/' + favList], ['renomear lista', 'PATCH', '/favorites/lists/' + favList, { name: 'Roubada' }], ['apagar lista', 'DELETE', '/favorites/lists/' + favList],
];
const results = await Promise.all(probes.map(([, m, p, b]) => call(m, p, b, evil.token)));
const leaks = results.map((r, i) => [probes[i][0], r.s]).filter(([, s]) => ![403, 404, 400, 409, 422].includes(s));
ok('um estranho nunca acessa nem altera dados de outro', leaks.length === 0, leaks);
ok('o estranho não vê pedidos, pagamentos nem conversas dos outros nas listas', (await call('GET', '/orders/mine', null, evil.token)).d.data.length === 0 && (await call('GET', '/payments/mine?role=client', null, evil.token)).d.data.length === 0 && (await call('GET', '/payments/mine?role=professional', null, evil.token)).d.data.length === 0 && (await call('GET', '/conversations', null, evil.token)).d.data.length === 0);
ok('nada foi alterado pelas tentativas', (await call('GET', '/orders/' + order, null, cli.token)).d.status === 'accepted' && (await call('GET', '/conversations/' + conv, null, cli.token)).d.messages.length === 1 && (await call('GET', '/pro/listings/' + listing.uuid, null, pro.token)).d.title === 'Instalação de chuveiro elétrico');
ok('cliente não acessa o painel profissional (403)', (await call('GET', '/pro/summary', null, cli.token)).s === 403 && (await call('GET', '/pro/orders', null, cli.token)).s === 403);
ok('cliente não aceita pedido (só o profissional)', (await call('POST', `/orders/${order}/complete`, { final_amount: 10 }, cli.token)).s === 403);

// ---------- rotas antigas removidas ----------
const gone = await Promise.all([['GET', '/users/' + pro.uuid], ['PATCH', '/users/' + cli.uuid], ['DELETE', '/users/' + cli.uuid], ['GET', '/professionals/search'], ['POST', '/professionals'], ['GET', '/professionals/' + pro.uuid]].map(([m, p]) => call(m, p, m === 'GET' ? null : {}, cli.token)));
ok('rotas antigas de usuário e profissional não existem mais', gone.every((r) => r.s === 404), gone.map((r) => r.s));
ok('a conta do cliente segue ativa depois do DELETE antigo', (await call('GET', '/auth/me', null, cli.token)).s === 200);

// ---------- dados sensíveis ----------
const profile = JSON.stringify((await call('GET', '/profile/' + pro.uuid, null, evil.token)).d);
ok('perfil público não vaza e-mail, telefone, documento nem chave Pix', !/@teste\.invalid|52998224725|529\.982|payout|passwordHash|password/i.test(profile), profile.slice(0, 200));
const listingJson = JSON.stringify((await call('GET', '/listings/' + listing.uuid)).d);
ok('anúncio público não vaza dados do dono', !/@teste\.invalid|52998224725|document|payout/i.test(listingJson));
const search = JSON.stringify((await call('GET', '/listings/search')).d);
ok('busca pública não vaza dados sensíveis', !/@teste\.invalid|52998224725|payout/i.test(search));
const me = JSON.stringify((await call('GET', '/auth/me', null, cli.token)).d);
ok('resposta de /auth/me não traz senha nem hash', !/passwordHash|"password"|"hash"/i.test(me));
const orderJson = JSON.stringify((await call('GET', '/orders/' + order, null, cli.token)).d);
ok('pedido não traz e-mail nem telefone da outra parte', !/@teste\.invalid|phone/i.test(orderJson));

// ---------- injeção e entrada maliciosa ----------
const inj = await call('GET', '/listings/search?q=' + encodeURIComponent("' OR 1=1 --") + '&city=' + encodeURIComponent('"; DROP TABLE users; --'));
ok('busca com texto de injeção SQL responde normalmente e sem resultados', inj.s === 200 && inj.d.meta.total === 0, inj.s);
ok('as tabelas continuam existindo', (await call('GET', '/categories')).s === 200);
ok('número de página absurdo não quebra', (await call('GET', '/listings/search?page=-5&limit=99999')).s === 200);
const big = await fetch(API + '/feedback', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cli.token }, body: JSON.stringify({ kind: 'bug', message: 'x'.repeat(200000) }) });
ok('corpo acima de 100 kB é recusado (413)', big.status === 413, big.status);
const badJson = await fetch(API + '/feedback', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cli.token }, body: '{oops' });
ok('JSON quebrado não derruba o servidor', badJson.status === 400 && (await call('GET', '/categories')).s === 200, badJson.status);
const proto = await call('POST', '/payments/order/' + order, JSON.parse('{"method":"pix","__proto__":{"admin":true}}'), cli.token);
ok('__proto__ no corpo é inofensivo', proto.s < 500, proto.s);

// ---------- upload ----------
const form = new FormData(); form.set('purpose', 'service'); form.set('file', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'x.png');
const fake = await fetch(API + '/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + cli.token }, body: form });
ok('arquivo que finge ser imagem é recusado', [400, 415].includes(fake.status), fake.status);
const form2 = new FormData(); form2.set('purpose', 'hack'); form2.set('file', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'x.png');
ok('destino inválido de upload é recusado', (await fetch(API + '/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + cli.token }, body: form2 })).status === 400);

// ---------- cabeçalhos ----------
const head = await fetch(API + '/categories');
ok('cabeçalhos de segurança presentes e sem X-Powered-By', head.headers.get('x-content-type-options') === 'nosniff' && head.headers.get('x-frame-options') === 'DENY' && head.headers.get('referrer-policy') === 'no-referrer' && !head.headers.get('x-powered-by'));
const cors = await fetch(API + '/categories', { headers: { origin: 'https://site-malicioso.example' } });
ok('CORS não libera origem desconhecida', cors.headers.get('access-control-allow-origin') !== 'https://site-malicioso.example' && cors.headers.get('access-control-allow-origin') !== '*');

// ---------- limite de taxa e sessão ----------
const attempts = [];
for (let i = 0; i < 12; i++) attempts.push((await call('POST', '/auth/login', { email: `alvo${Date.now()}@teste.invalid`.replace(/\d+/, '1'), password: 'errada-123' })).s);
ok('login com senha errada é limitado (429 depois de 10 tentativas)', attempts.slice(0, 10).every((s) => s === 401) && attempts.slice(10).every((s) => s === 429), attempts);
ok('login correto de outro e-mail continua funcionando', (await call('POST', '/auth/login', { email: pro.email, password: PW })).s === 200);
ok('token adulterado é recusado', (await call('GET', '/auth/me', null, cli.token.slice(0, -3) + 'abc')).s === 401);
const out = await call('POST', '/auth/login', { email: evil.email, password: PW });
const sessions = (await call('GET', '/account/sessions', null, out.d.token)).d;
ok('sessões listadas são só as do próprio usuário', Array.isArray(sessions.sessions ?? sessions) && (sessions.sessions ?? sessions).length >= 1);

console.log(JSON.stringify({ pass, fail }));
process.exit(fail ? 1 : 0);
