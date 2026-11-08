import { execFileSync } from 'node:child_process';
import { call, register, publishListing } from '../lib/fixtures.mjs';
const sql = (q) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', q]).toString().trim();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };

const pro = await register('ProMsg'), cli = await register('CliMsg'), spy = await register('Intruso');
const listing = await publishListing(pro);
const open = await call('POST', '/conversations', { listing_uuid: listing.uuid }, cli.token);
const conv = open.d.uuid;
ok('conversa aberta', open.s === 200 || open.s === 201, open);
const send = (token, body) => call('POST', `/conversations/${conv}/messages`, { body }, token);
const unread = async (who) => (await call('GET', '/conversations/unread-count', null, who.token)).d.count;
const listUnread = async (who) => (await call('GET', '/conversations', null, who.token)).d.find?.((c) => c.uuid === conv)?.unread ?? (await call('GET', '/conversations', null, who.token)).d;

await send(cli.token, 'Olá, tudo bem?');
await send(cli.token, 'Tem horário amanhã?');
ok('profissional tem 2 não lidas', (await unread(pro)) === 2, await unread(pro));
ok('o cliente (quem enviou) não tem não lidas', (await unread(cli)) === 0);

ok('outra pessoa não consegue marcar a conversa como lida', (await call('POST', `/conversations/${conv}/read`, null, spy.token)).s >= 400 && (await unread(pro)) === 2);
// Responder também conta como ter lido.
await send(pro.token, 'Tenho sim!');
ok('responder zera as não lidas de quem respondeu', (await unread(pro)) === 0, await unread(pro));
await send(cli.token, 'Ótimo');
await send(cli.token, 'Então fechado');
ok('duas novas voltam a contar', (await unread(pro)) === 2);
const read = await call('POST', `/conversations/${conv}/read`, null, pro.token);
ok('abrir (marcar lida) zera o contador do profissional', read.s === 200 && (await unread(pro)) === 0, read);
ok('o contador do cliente é independente (ele respondeu depois, então está em dia)', (await unread(cli)) === 0, await unread(cli));
await send(cli.token, 'Perfeito, obrigado');
ok('mensagem nova faz o contador voltar', (await unread(pro)) === 1);
await call('POST', `/conversations/${conv}/read`, null, pro.token);
ok('ler de novo zera outra vez', (await unread(pro)) === 0);
await call('POST', `/conversations/${conv}/read`, null, pro.token);
ok('marcar lida duas vezes não quebra', (await unread(pro)) === 0);

// Privacidade: com a confirmação desligada, o outro lado não vê "lida".
const before = (await call('GET', `/conversations/${conv}`, null, cli.token)).d;
ok('com a confirmação ligada, o cliente vê que o profissional leu', before.messages.filter((m) => m.mine).every((m) => m.read), before.messages);
await call('PATCH', '/settings/privacy', { read_receipts: false }, pro.token);
await send(cli.token, 'Mais uma dúvida');
await call('POST', `/conversations/${conv}/read`, null, pro.token);
const after = (await call('GET', `/conversations/${conv}`, null, cli.token)).d;
ok('com a confirmação desligada, a última mensagem do cliente aparece como não lida', after.messages.filter((m) => m.mine).at(-1).read === false, after.messages.at(-1));
ok('mesmo assim o contador do profissional zera', (await unread(pro)) === 0);

// Relógio do banco adiantado: mensagem "do futuro" também precisa ficar lida.
await send(cli.token, 'Mensagem com relógio adiantado');
sql(`UPDATE messages SET created_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 3 HOUR) ORDER BY id DESC LIMIT 1`);
ok('mensagem com horário adiantado conta como não lida', (await unread(pro)) === 1, await unread(pro));
await call('POST', `/conversations/${conv}/read`, null, pro.token);
ok('e zera ao abrir, mesmo com o relógio do banco adiantado', (await unread(pro)) === 0, await unread(pro));

const a = await unread(pro);
console.log(JSON.stringify({ pass, fail, a }));
process.exitCode = fail ? 1 : 0;
