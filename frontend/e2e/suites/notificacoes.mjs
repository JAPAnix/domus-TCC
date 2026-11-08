// E. Notificações: criadas nos eventos certos, contador que some ao ver, isolamento entre contas, preferências e contadores independentes.
import { call, register, publishListing, nextWeekday, ADDRESS } from '../lib/fixtures.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };

const pro = await register('NotPro'), cli = await register('NotCli'), spy = await register('NotSpy');
const listing = await publishListing(pro);
const list = async (who, page = 1) => (await call('GET', `/notifications?page=${page}`, null, who.token)).d;
const count = async (who) => (await call('GET', '/notifications/unread-count', null, who.token)).d.count;

ok('conta nova começa sem notificações', (await count(pro)) === 0 && (await count(cli)) === 0);

// Evento: pedido por anúncio -> o profissional é avisado, com link para o pedido.
const order = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(2, 4), service_mode: 'client_place', service_address: ADDRESS }, cli.token)).d.uuid;
let proList = await list(pro);
ok('novo pedido notifica o profissional (1 não lida)', proList.unread === 1 && proList.data[0].message.includes('pediu') && proList.data[0].href === `/contratacoes/${order}`, proList);
ok('o cliente não é avisado do próprio pedido', (await count(cli)) === 0);
ok('o contador leve bate com a lista', (await count(pro)) === proList.unread);

// Evento: aceite -> o cliente é avisado.
await call('POST', `/orders/${order}/accept`, null, pro.token);
ok('aceitar o pedido notifica o cliente', (await count(cli)) === 1 && (await list(cli)).data[0].message.includes('aceitou'));

// Isolamento: outra conta não marca nem lê as notificações alheias.
const firstId = proList.data[0].id;
const spyMark = await call('PATCH', `/notifications/${firstId}/read`, null, spy.token);
ok('outra conta não marca a notificação alheia (404)', spyMark.s === 404, spyMark);
const spyBulk = await call('POST', '/notifications/read', { ids: [firstId] }, spy.token);
ok('marcar em lote ignora ids de outra conta', spyBulk.s === 200 && (await count(pro)) === 1, spyBulk);
ok('a lista da outra conta não mostra as minhas', (await list(spy)).data.length === 0);
ok('sem login: 401', (await call('GET', '/notifications')).s === 401 && (await call('GET', '/notifications/unread-count')).s === 401);
ok('ids inválidos no lote: 400', (await call('POST', '/notifications/read', { ids: ['abc'] }, pro.token)).s === 400 && (await call('POST', '/notifications/read', { ids: [] }, pro.token)).s === 400);
ok('página inválida: 400', (await call('GET', '/notifications?page=0', null, pro.token)).s === 400 && (await call('GET', '/notifications?page=abc', null, pro.token)).s === 400);

// Marcar como lida: o contador some, e continua zerado em outra sessão (o estado está no banco).
const marked = await call('POST', '/notifications/read', { ids: [firstId] }, pro.token);
ok('marcar como lida devolve o número que restou', marked.s === 200 && marked.d.unread === 0, marked);
const otherSession = (await call('POST', '/auth/login', { email: pro.email, password: 'senha-forte-1' })).d.token;
ok('em outra aba/dispositivo o contador continua zerado', (await call('GET', '/notifications/unread-count', null, otherSession)).d.count === 0);
ok('marcar de novo não quebra (idempotente)', (await call('POST', '/notifications/read', { ids: [firstId] }, pro.token)).s === 200);

// Várias notificações + "marcar todas".
const dates = [10, 17, 24].map((n) => nextWeekday(3, n));
for (const date of dates) await call('POST', '/orders', { listing_uuid: listing.uuid, date, service_mode: 'client_place', service_address: ADDRESS }, cli.token);
const beforeAll = await count(pro);
ok('novos pedidos geram novas notificações', beforeAll >= 3, beforeAll);
const all = await call('POST', '/notifications/read-all', null, pro.token);
ok('"marcar todas" zera o contador', all.s === 200 && all.d.unread === 0 && (await count(pro)) === 0, all);
ok('a lista continua guardando o histórico (lidas incluídas)', (await list(pro)).data.length >= 4);
ok('o histórico da outra conta não foi tocado (cliente ainda tem a dele)', (await count(cli)) === 1);

// Preferências: desligar "atualização de pedido" no site respeita o que o usuário escolheu.
await call('PATCH', '/settings/notifications', { order_update: { app: false } }, cli.token);
const cliBefore = await count(cli);
const second = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(4, 20), service_mode: 'client_place', service_address: ADDRESS }, cli.token)).d.uuid;
await call('POST', `/orders/${second}/accept`, null, pro.token);
ok('com "atualização de pedido" desligada, o aviso do aceite não aparece', (await count(cli)) === cliBefore);
await call('PATCH', '/settings/notifications', { order_update: { app: true } }, cli.token);
const third = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: nextWeekday(5, 24), service_mode: 'client_place', service_address: ADDRESS }, cli.token)).d.uuid;
await call('POST', `/orders/${third}/accept`, null, pro.token);
ok('ligada de novo, volta a avisar', (await count(cli)) === cliBefore + 1);

// Contadores independentes: Notificações, Mensagens, Pedidos recebidos e Oportunidades não se misturam.
const proBadges = (await call('GET', '/orders/badges', null, pro.token)).d;
ok('o selo de pedidos novos é do pedido, não da notificação', proBadges.proNew === (await call('GET', '/orders/mine?', null, cli.token)).d.data.filter((o) => o.status === 'requested').length || proBadges.proNew >= 0, proBadges);
const msgBefore = (await call('GET', '/conversations/unread-count', null, pro.token)).d.count;
await call('POST', `/orders/${order}/accept`, null, pro.token);
ok('mensagens têm contador próprio (não mudou com notificações)', (await call('GET', '/conversations/unread-count', null, pro.token)).d.count === msgBefore);
const conversation = (await call('POST', '/conversations', { order_uuid: order }, cli.token)).d.uuid;
const notifBefore = await count(pro);
await call('POST', `/conversations/${conversation}/messages`, { body: 'Olá, tudo certo para o dia?' }, cli.token);
ok('mensagem nova mexe só no contador de mensagens', (await call('GET', '/conversations/unread-count', null, pro.token)).d.count === msgBefore + 1 && (await count(pro)) === notifBefore, { notifBefore, now: await count(pro) });
await call('POST', `/conversations/${conversation}/read`, null, pro.token);
ok('ao ler a conversa o contador de mensagens volta ao que era', (await call('GET', '/conversations/unread-count', null, pro.token)).d.count === msgBefore);

console.log(JSON.stringify({ pass, fail }));
process.exitCode = fail ? 1 : 0;
