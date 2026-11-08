import { execFileSync } from 'node:child_process';
import { call, register, publishListing, nextWeekday } from '../lib/fixtures.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };
const sql = (q) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '--default-character-set=utf8mb4', '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', q]).toString().trim();

const pro = await register('ProProp'), cli = await register('CliProp'), other = await register('OutroProp');
const listing = await publishListing(pro, { pricing_model: 'quote' }, 'Reforma de banheiro completa');
ok('anúncio sob consulta publicado', listing.status === 200 || listing.status === 201, listing);
const date = nextWeekday(2, 3);
const book = (token, extra = {}) => call('POST', '/orders', { listing_uuid: listing.uuid, date, service_mode: 'remote', note: 'Preciso trocar piso e louças.', ...extra }, token);

// ---- pedido ----
const made = await book(cli.token);
ok('cliente cria o pedido sob consulta', made.s === 201, made);
const uuid = made.d.uuid;
let o = (await call('GET', '/orders/' + uuid, null, pro.token)).d;
ok('pedido nasce "requested" com prazo de resposta de 72 h', o.status === 'requested' && o.urgency?.level === 'ok' && o.urgency.hoursLeft >= 71 && o.urgency.hoursLeft <= 72, o);
ok('pro vê só propor/recusar; cliente só cancelar', o.actions.join() === 'propose,decline' || o.actions.slice().sort().join() === 'decline,propose', o.actions);
ok('estranho não acessa o pedido', (await call('GET', '/orders/' + uuid, null, other.token)).s === 404);
ok('aceitar direto um sob consulta é recusado (409)', (await call('POST', `/orders/${uuid}/accept`, null, pro.token)).s === 409);

// ---- contadores ----
let b = (await call('GET', '/orders/badges', null, pro.token)).d;
ok('selo do menu do profissional conta 1 pedido novo', b.proNew === 1, b);
let counts = (await call('GET', '/orders/counts?side=professional', null, pro.token)).d;
ok('abas com contagem: novos=1', counts.new === 1 && counts.proposed === 0 && counts.all === 1, counts);
ok('notificação para o profissional', sql(`SELECT COUNT(*) FROM notifications WHERE event_key='order-requested:${uuid}'`) === '1');

// ---- prévia de ganhos ----
const prev = await call('POST', '/orders/earnings-preview', { amount: 1000 }, pro.token);
ok('prévia: comissão e ganho líquido', prev.s === 200 && prev.d.earnings === 1000 - prev.d.commission && prev.d.commissionPercent >= 0, prev.d);
ok('prévia recusa valor inválido', (await call('POST', '/orders/earnings-preview', { amount: -3 }, pro.token)).s === 400);

// ---- proposta: validações e permissões ----
const P = (token, body) => call('POST', `/orders/${uuid}/propose`, body, token);
ok('cliente não envia proposta', (await P(cli.token, { amount: 100, days: 2 })).s >= 400);
ok('estranho não envia proposta', (await P(other.token, { amount: 100, days: 2 })).s >= 400);
ok('proposta sem valor é recusada (400)', (await P(pro.token, { days: 2 })).s === 400);
ok('proposta sem prazo é recusada (400)', (await P(pro.token, { amount: 100 })).s === 400);
const sent = await P(pro.token, { amount: 1800, days: 5, included: 'Material e mão de obra', note: 'Começo na terça.', valid_hours: 24 });
ok('proposta válida: pedido vira "proposed"', sent.s === 200 && sent.d.status === 'proposed', sent);
ok('não propõe duas vezes', (await P(pro.token, { amount: 1700, days: 5 })).s >= 400);
o = (await call('GET', '/orders/' + uuid, null, cli.token)).d;
ok('cliente vê a proposta completa', o.proposal?.amount === 1800 && o.proposal.days === 5 && o.proposal.included === 'Material e mão de obra' && o.status === 'proposed', o.proposal);
ok('cliente pode aceitar, recusar ou cancelar', o.actions.slice().sort().join() === 'accept_proposal,cancel,reject_proposal', o.actions);
ok('prazo agora é a validade da proposta (24 h)', o.urgency?.level === 'soon' && o.urgency.hoursLeft <= 24, o.urgency);
ok('notificação ao cliente', sql(`SELECT COUNT(*) FROM notifications WHERE event_key LIKE 'order-propose:${uuid}%'`) === '1');
b = (await call('GET', '/orders/badges', null, cli.token)).d;
ok('selo do cliente conta a proposta para decidir', b.clientToDecide === 1, b);
ok('pro não aceita a própria proposta', (await call('POST', `/orders/${uuid}/accept_proposal`, null, pro.token)).s >= 400);
ok('sem endereço exato antes de aceitar (remoto: nenhum)', o.serviceAddress == null);

// ---- aceitar -> pagamento ----
const accepted = await call('POST', `/orders/${uuid}/accept_proposal`, null, cli.token);
ok('cliente aceita a proposta', accepted.s === 200 && accepted.d.status === 'accepted', accepted);
o = (await call('GET', '/orders/' + uuid, null, cli.token)).d;
ok('o valor da proposta vira o preço do pedido', o.price === 1800 && o.pricingModel === 'fixed' && o.total === 1800, { price: o.price, total: o.total });
ok('sem prazo de expiração depois de aceito', o.deadline == null);
await call('PUT', '/payments/receiving', { methods: ['cash'] }, pro.token);
const pay = await call('POST', `/payments/order/${uuid}`, { method: 'cash' }, cli.token);
ok('cliente inicia o pagamento (direto) pelo valor da proposta', pay.s === 200 || pay.s === 201, pay);
const payList = (await call('GET', `/payments/order/${uuid}`, null, cli.token)).d;
ok('pagamento registrado com R$ 1.800,00', JSON.stringify(payList).includes('1800'), payList);
ok('profissional inicia', (await call('POST', `/orders/${uuid}/start`, null, pro.token)).s === 200);
const done = await call('POST', `/orders/${uuid}/complete`, { final_amount: 1800 }, pro.token);
ok('profissional conclui', done.s === 200 && done.d.status === 'completed', done);
counts = (await call('GET', '/orders/counts?side=client', null, cli.token)).d;
ok('contagem do cliente: concluído=1', counts.done === 1 && counts.proposed === 0, counts);

// ---- recusar com motivo ----
const date2 = nextWeekday(3, 4);
const second = await call('POST', '/orders', { listing_uuid: listing.uuid, date: date2, service_mode: 'remote' }, cli.token);
const u2 = second.d.uuid;
ok('motivo longo demais é recusado', (await call('POST', `/orders/${u2}/decline`, { reason: 'x'.repeat(201) }, pro.token)).s === 400);
const declined = await call('POST', `/orders/${u2}/decline`, { reason: 'Não atendo essa região.' }, pro.token);
ok('profissional recusa com motivo', declined.s === 200 && declined.d.status === 'declined', declined);
o = (await call('GET', '/orders/' + u2, null, cli.token)).d;
ok('cliente vê o motivo da recusa', o.declineReason === 'Não atendo essa região.', o.declineReason);
ok('notificação da recusa traz o motivo', sql(`SELECT message FROM notifications WHERE event_key='order-decline:${u2}'`).includes('Não atendo essa região.'));

// ---- cliente recusa proposta ----
const date3 = nextWeekday(4, 5);
const u3 = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: date3, service_mode: 'remote' }, cli.token)).d.uuid;
await call('POST', `/orders/${u3}/propose`, { amount: 500, days: 1 }, pro.token);
const rej = await call('POST', `/orders/${u3}/reject_proposal`, null, cli.token);
ok('cliente recusa a proposta (pedido cancelado)', rej.s === 200 && rej.d.status === 'cancelled', rej);
ok('profissional é avisado', Number(sql(`SELECT COUNT(*) FROM notifications WHERE event_key='order-reject_proposal:${u3}'`)) === 1);

// ---- expiração ----
const date4 = nextWeekday(5, 6);
const u4 = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: date4, service_mode: 'remote' }, cli.token)).d.uuid;
sql(`UPDATE orders SET expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 HOUR) WHERE uuid = UNHEX(REPLACE('${u4}','-',''))`);
// ---- expiração (rotina real, em outro processo, contra o mesmo banco) ----
const run = () => JSON.parse(execFileSync('node', ['expiry-run.mjs'], { cwd: process.cwd() }).toString().trim().split('\n').pop());
const byUuid = (u) => `uuid = UNHEX(REPLACE('${u}','-',''))`;
let r = run();
ok('rotina avisa pedido que vence em 5 h', r.warned >= 1 && r.expired === 0, r);
ok('aviso ao profissional e ao cliente', sql(`SELECT COUNT(*) FROM notifications WHERE event_key IN ('order-expiring:${u4}:requested:p','order-expiring:${u4}:requested:c')`) === '2');
r = run();
ok('o aviso não se repete', r.warned === 0, r);
sql(`UPDATE orders SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE ${byUuid(u4)}`);
const late = await call('POST', `/orders/${u4}/propose`, { amount: 900, days: 2 }, pro.token);
ok('agir depois do prazo: 409 e o pedido vira expirado', late.s === 409 && sql(`SELECT status FROM orders WHERE ${byUuid(u4)}`) === 'expired', late);
o = (await call('GET', '/orders/' + u4, null, cli.token)).d;
ok('cliente vê "Expirado" sem ações', o.status === 'expired' && o.actions.length === 0, o);
const u5 = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(1, 10), service_mode: 'remote' }, cli.token)).d.uuid;
await call('POST', `/orders/${u5}/propose`, { amount: 700, days: 2, valid_hours: 24 }, pro.token);
sql(`UPDATE orders SET proposal_valid_until = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE ${byUuid(u5)}`);
r = run();
ok('rotina expira a proposta vencida', r.expired >= 1 && sql(`SELECT status FROM orders WHERE ${byUuid(u5)}`) === 'expired', r);
ok('as duas partes são avisadas', sql(`SELECT COUNT(*) FROM notifications WHERE event_key IN ('order-expired:${u5}:c','order-expired:${u5}:p')`) === '2');
ok('aceitar proposta expirada é recusado', (await call('POST', `/orders/${u5}/accept_proposal`, null, cli.token)).s >= 400);
counts = (await call('GET', '/orders/counts?side=professional', null, pro.token)).d;
ok('expirados entram em Recusados/Expirados', counts.closed >= 3, counts);

// ---- limite diário ----
const heavy = await register('Spam');
sql(`INSERT INTO orders (uuid, listing_id, client_id, professional_id, status, scheduled_date, service_mode, title_snapshot, pricing_model_snapshot, platform_fee_percent, created_at, updated_at) SELECT UNHEX(REPLACE(UUID(),'-','')), l.id, u.id, l.owner_id, 'declined', '2030-01-01', 'remote', 'x', 'quote', 0, NOW(), NOW() FROM listings l, users u, (SELECT 1 FROM orders LIMIT 20) t WHERE u.email='${heavy.email}' AND l.title='Reforma de banheiro completa' LIMIT 20`);
const capped = await call('POST', '/orders', { listing_uuid: listing.uuid, date, service_mode: 'remote' }, heavy.token);
ok('mais de 20 pedidos em 24 h: 429 com orientação', capped.s === 429 && /24 horas/.test(capped.d.message), capped);
console.log(JSON.stringify({ pass, fail }));
console.log(JSON.stringify({ pass, fail }));
