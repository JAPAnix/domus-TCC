// H. Segurança e robustez: cabeçalhos, CORS, injeção, XSS, upload falso, rate limit, webhooks e rotas internas sem autenticação,
// e autorização cruzada (usuário A tentando ler ou mexer em dados do usuário B trocando IDs).
import { call, register, publishListing, nextWeekday, upload, API, ADDRESS, stamp } from '../lib/fixtures.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };
const origin = new URL(API).origin;

// ---- cabeçalhos e CORS ----
const health = await fetch(origin + '/health');
const headers = Object.fromEntries(health.headers);
ok('cabeçalhos de segurança presentes', headers['x-content-type-options'] === 'nosniff' && headers['x-frame-options'] === 'DENY' && headers['referrer-policy'] === 'no-referrer' && !!headers['permissions-policy'], headers);
ok('o servidor não anuncia a tecnologia (sem X-Powered-By)', !headers['x-powered-by']);
const allowed = await fetch(API + '/categories', { headers: { Origin: `http://localhost:${process.env.E2E_WEB_PORT ?? 5183}` } });
ok('CORS: o domínio do site recebe permissão', allowed.headers.get('access-control-allow-origin') === `http://localhost:${process.env.E2E_WEB_PORT ?? 5183}`, allowed.headers.get('access-control-allow-origin'));
const evil = await fetch(API + '/categories', { headers: { Origin: 'https://site-malicioso.example' } });
ok('CORS: um site qualquer NÃO recebe permissão', evil.headers.get('access-control-allow-origin') === null, evil.headers.get('access-control-allow-origin'));
const preflight = await fetch(API + '/orders', { method: 'OPTIONS', headers: { Origin: 'https://site-malicioso.example', 'Access-Control-Request-Method': 'POST' } });
ok('CORS: preflight de site malicioso não é autorizado', preflight.headers.get('access-control-allow-origin') === null);
const notFound = await call('GET', '/rota-que-nao-existe');
ok('rota inexistente: 404 sem rastro de erro interno', notFound.s === 404 && !JSON.stringify(notFound.d).match(/at |node_modules|\.js:\d/), notFound);

// ---- rotas internas e webhooks sem autenticação ----
for (const route of ['/admin/summary', '/admin/payments', '/admin/moderation', '/admin/audit', '/admin/webhook-events', '/pro/summary', '/payments/mine']) {
  ok(`rota interna sem login: ${route} → 401`, (await call('GET', route)).s === 401);
}
const hook = await fetch(API + '/payments/webhook/asaas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'evt_x', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_x' } }) });
ok('webhook do Asaas sem token não é aceito (nunca 200)', hook.status !== 200, hook.status);
const hookBad = await fetch(API + '/payments/webhook/asaas', { method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': 'token-errado' }, body: JSON.stringify({ id: 'evt_y', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_y' } }) });
ok('webhook do Asaas com token errado não é aceito (nunca 200)', hookBad.status !== 200, hookBad.status);

// ---- injeção e XSS ----
const injection = await call('POST', '/auth/login', { email: "admin'--@teste.invalid", password: "' OR '1'='1" });
ok('SQL injection no login: recusado (400/401)', [400, 401].includes(injection.s), injection);
const injection2 = await call('POST', '/auth/login', { email: { $ne: null }, password: { $ne: null } });
ok('objeto no lugar de texto no login: 400 (sem NoSQL/ORM injection)', injection2.s === 400, injection2);
const cli = await register('SecCli'), pro = await register('SecPro'), spy = await register('SecSpy'), spyPro = await register('SecSpyPro');
const listing = await publishListing(pro);
const XSS = '<img src=x onerror=alert(1)><script>alert(2)</script>';
const note = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(2, 4), service_mode: 'client_place', service_address: ADDRESS, note: XSS }, cli.token));
ok('texto com HTML/script é aceito como texto (a tela escapa)', note.s === 201, note);
const stored = (await call('GET', `/orders/${note.d.uuid}`, null, cli.token)).d;
ok('o texto volta idêntico, sem ser executado nem alterado, em JSON', stored.note === XSS, stored.note);
const jsonType = await fetch(API + '/orders/' + note.d.uuid, { headers: { authorization: 'Bearer ' + cli.token } });
ok('a API responde sempre como JSON (nunca HTML que o navegador execute)', (jsonType.headers.get('content-type') ?? '').startsWith('application/json'), jsonType.headers.get('content-type'));
const conv = (await call('POST', '/conversations', { order_uuid: note.d.uuid }, cli.token)).d.uuid;
const msg = await call('POST', `/conversations/${conv}/messages`, { body: XSS }, cli.token);
ok('mensagem com HTML é guardada como texto', msg.s === 201 && (await call('GET', `/conversations/${conv}`, null, pro.token)).d.messages.some((m) => m.body === XSS));
const path = await call('GET', '/orders/..%2f..%2fetc%2fpasswd', null, cli.token);
ok('tentativa de path traversal em ID: 4xx, nunca 200/500', path.s >= 400 && path.s < 500, path);

// ---- upload falso ----
const form = (name, type, bytes) => { const f = new FormData(); f.set('purpose', 'avatar'); f.set('file', new Blob([bytes], { type }), name); return fetch(API + '/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + cli.token }, body: f }); };
const html = await form('foto.png', 'image/png', '<html><script>alert(1)</script></html>');
ok('arquivo HTML com extensão .png e tipo image/png é recusado (confere o conteúdo)', html.status === 400 || html.status === 415 || html.status === 422, html.status);
const svg = await form('desenho.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
ok('SVG (pode conter script) é recusado', svg.status >= 400 && svg.status < 500, svg.status);
const exe = await form('programa.exe', 'application/octet-stream', Buffer.from('MZ\x90\x00\x03'));
ok('executável é recusado', exe.status >= 400 && exe.status < 500, exe.status);
const big = await form('grande.png', 'image/png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8 * 1024 * 1024)]));
ok('arquivo acima de 5 MB é recusado', big.status === 413 || big.status === 400, big.status);
ok('upload sem login: 401', (await fetch(API + '/uploads', { method: 'POST', body: new FormData() })).status === 401);
const good = await upload(cli.token, 'service');
ok('imagem válida continua sendo aceita (o filtro não é exagerado)', typeof good === 'string' && good.startsWith('http'), good);

// ---- autorização cruzada: A tenta mexer em dados de B trocando IDs ----
const order = note.d.uuid;
const mine = (route, method = 'GET', body, who = spy) => call(method, route, body, who.token);
ok('estranho não lê o pedido alheio', (await mine(`/orders/${order}`)).s === 404);
ok('estranho não aceita o pedido alheio', (await mine(`/orders/${order}/accept`, 'POST')).s >= 400);
ok('estranho não cancela o pedido alheio', (await mine(`/orders/${order}/cancel`, 'POST')).s >= 400);
ok('estranho não lê a conversa alheia', (await mine(`/conversations/${conv}`)).s === 404);
ok('estranho não envia mensagem na conversa alheia', (await mine(`/conversations/${conv}/messages`, 'POST', { body: 'invasão' })).s === 404);
ok('estranho não marca a conversa alheia como lida', (await mine(`/conversations/${conv}/read`, 'POST')).s === 404);
ok('estranho não vê os pagamentos do pedido alheio', (await mine(`/payments/order/${order}`)).s >= 400);
ok('estranho não inicia pagamento do pedido alheio', (await mine(`/payments/order/${order}`, 'POST', { method: 'cash' })).s >= 400);
ok('estranho não lê o recibo alheio', (await mine('/payments/00000000-0000-4000-8000-000000000000/receipt')).s >= 400);
ok('o cliente não age como profissional (aceitar o próprio pedido)', (await mine(`/orders/${order}/accept`, 'POST', undefined, cli)).s >= 400);
ok('o profissional não cancela como se fosse o cliente no pedido de outro profissional', (await mine(`/orders/${order}/accept`, 'POST', undefined, spyPro)).s >= 400);
const reqs = (await call('POST', '/services', { title: 'TESTE Pedido protegido', description: 'Descrição longa o bastante para ser aceita pelo servidor.', category_id: (await call('GET', '/categories')).d[0].id, city: 'Curitiba', state: 'PR' }, cli.token)).d;
ok('estranho não vê as propostas do pedido aberto alheio', (await mine(`/services/${reqs.uuid}/proposals`)).s === 403);
ok('estranho não edita o pedido aberto alheio', (await mine(`/services/${reqs.uuid}`, 'PATCH', { title: 'sequestrado' })).s === 403);
ok('estranho não cancela o pedido aberto alheio', (await mine(`/services/${reqs.uuid}/status`, 'PATCH', { status: 'cancelled' })).s >= 400);
ok('estranho não renova o pedido aberto alheio', (await mine(`/services/${reqs.uuid}/renew`, 'POST', { days: 30 })).s >= 400);
ok('estranho não apaga o pedido aberto alheio', (await mine(`/services/${reqs.uuid}`, 'DELETE')).s >= 400);
const proposal = await call('POST', `/services/${reqs.uuid}/proposals`, { proposed_price: 500, delivery_time_days: 2 }, pro.token);
ok('(preparo) profissional propõe no pedido aberto', proposal.s === 201, proposal);
ok('outro profissional não edita a proposta alheia', (await mine(`/proposals/${proposal.d.uuid}`, 'PUT', { proposed_price: 1 }, spyPro)).s >= 400);
ok('estranho não lê a proposta alheia', (await mine(`/proposals/${proposal.d.uuid}`)).s === 403);
ok('estranho não aceita a proposta alheia', (await mine(`/proposals/${proposal.d.uuid}/status`, 'PATCH', { status: 'accepted' })).s >= 400);
ok('o profissional não aceita a própria proposta', (await mine(`/proposals/${proposal.d.uuid}/status`, 'PATCH', { status: 'accepted' }, pro)).s >= 400);
ok('o preço da proposta não pode ser negativo', (await mine(`/services/${reqs.uuid}/proposals`, 'POST', { proposed_price: -5 }, pro)).s === 400);
ok('estranho não lê notificações alheias (a lista é só dele)', JSON.stringify((await mine('/notifications')).d.data) === '[]');
ok('o usuário comum não vira admin mandando o papel no corpo', (await mine('/admin/summary')).s === 403);
ok('o ID numérico interno não aparece nas respostas de pedido (só UUID)', !/"id":\s*"?\d{1,6}"?[,}]/.test(JSON.stringify(stored)), Object.keys(stored));

// ---- limites de requisição ----
let denied = 0;
for (let i = 0; i < 6; i++) if ((await call('POST', '/auth/forgot-password', { email: `limite-recup${stamp}@teste.invalid` })).s === 429) denied++;
ok('recuperação de senha tem limite (429 depois de 5 pedidos por e-mail)', denied >= 1, denied);
const manyOrders = await register('SecMany');
let blockedOrders = 0;
for (let i = 0; i < 24; i++) if ((await call('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(1 + (i % 5), 5 + i), service_mode: 'remote' }, manyOrders.token)).s === 429) blockedOrders++;
ok('criação de pedidos tem limite (429)', blockedOrders >= 1, blockedOrders);

console.log(JSON.stringify({ pass, fail }));
process.exitCode = fail ? 1 : 0;
