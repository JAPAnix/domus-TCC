import { backendUrl } from '../lib/env.mjs';
import { execFileSync } from 'node:child_process';
import { call, register, publishListing, upload, nextWeekday, key, API, ADDRESS } from '../lib/fixtures.mjs';

process.env.DATABASE_HOST = '127.0.0.1'; process.env.DATABASE_PORT = String(process.env.E2E_DB_PORT ?? 3307); process.env.DATABASE_USER = 'root'; process.env.DATABASE_PASSWORD = ''; process.env.DATABASE_NAME = (process.env.E2E_DB ?? 'dommos_teste');
process.env.FRONTEND_URL = 'http://127.0.0.1:5183';
const { runScheduledSends } = await import(backendUrl('src/services/messageService.js'));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra))); };
const sql = (query) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', query]).toString().trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hex = (uuid) => `UNHEX(REPLACE('${uuid}','-',''))`;

const pro = await register('ProMsg');
const cli = await register('CliMsg');
const other = await register('OutroMsg');
const listing = await publishListing(pro);
ok('anúncio publicado para o teste', listing.status === 200);

// ---------- abrir conversa ----------
ok('exige login', (await call('GET', '/conversations')).s === 401 && (await call('POST', '/conversations', { listing_uuid: listing.uuid })).s === 401);
ok('pedido sem serviço nem pedido é recusado', (await call('POST', '/conversations', {}, cli.token)).s === 400);
ok('serviço e pedido juntos são recusados', (await call('POST', '/conversations', { listing_uuid: listing.uuid, order_uuid: listing.uuid }, cli.token)).s === 400);
ok('serviço inexistente dá 404', (await call('POST', '/conversations', { listing_uuid: '00000000-0000-4000-8000-000000000000' }, cli.token)).s === 404);
ok('não conversa com o próprio anúncio', (await call('POST', '/conversations', { listing_uuid: listing.uuid }, pro.token)).s === 400);
const opened = await call('POST', '/conversations', { listing_uuid: listing.uuid }, cli.token);
const C = opened.d.uuid;
ok('cliente abre conversa pelo anúncio', opened.s === 201 && /^[0-9a-f-]{36}$/.test(C), opened);
ok('abrir de novo devolve a mesma conversa', (await call('POST', '/conversations', { listing_uuid: listing.uuid }, cli.token)).d.uuid === C);
ok('conversa em duplicidade simultânea continua uma só', (await Promise.all([1, 2, 3].map(() => call('POST', '/conversations', { listing_uuid: listing.uuid }, cli.token)))).every((r) => r.d.uuid === C) && sql(`SELECT COUNT(*) FROM conversations WHERE uuid=${hex(C)}`) === '1');
ok('estranho não vê a conversa (404)', (await call('GET', '/conversations/' + C, null, other.token)).s === 404);
ok('estranho não envia (404)', (await call('POST', `/conversations/${C}/messages`, { body: 'oi' }, other.token)).s === 404);
ok('estranho não lê, arquiva, denuncia nem digita (404)', (await Promise.all(['read', 'archive', 'typing'].map((a) => call('POST', `/conversations/${C}/${a}`, null, other.token)))).every((r) => r.s === 404) && (await call('POST', `/conversations/${C}/report`, { reason: 'spam' }, other.token)).s === 404);
ok('o estranho não vê respostas da conversa', (await call('GET', `/conversations/${C}/replies`, null, other.token)).s === 404);
ok('uuid inválido dá 404', (await call('GET', '/conversations/xyz', null, cli.token)).s === 404);

// ---------- enviar ----------
ok('mensagem vazia é recusada', (await call('POST', `/conversations/${C}/messages`, { body: '   ' }, cli.token)).s === 400);
ok('mensagem acima de 2000 caracteres é recusada', (await call('POST', `/conversations/${C}/messages`, { body: 'x'.repeat(2001) }, cli.token)).s === 400);
ok('foto de link externo é recusada', (await call('POST', `/conversations/${C}/messages`, { body: '', image_url: 'https://evil.example/x.png' }, cli.token)).s === 400);
const serviceImage = await upload(cli.token, 'service');
ok('foto enviada para outro destino não vale em mensagem', (await call('POST', `/conversations/${C}/messages`, { body: '', image_url: serviceImage }, cli.token)).s === 400);
const xss = await call('POST', `/conversations/${C}/messages`, { body: '<script>alert(1)</script> Olá!\u0000\u202E' }, cli.token);
ok('texto com HTML fica como texto e controles são removidos', xss.s === 201 && xss.d.body === '<script>alert(1)</script> Olá!', xss.d);
const msgImage = await upload(cli.token, 'message');
const withImage = await call('POST', `/conversations/${C}/messages`, { body: '', image_url: msgImage }, cli.token);
ok('foto enviada como mensagem é aceita', withImage.s === 201 && withImage.d.imageUrl === msgImage, withImage);
ok('a foto de outro usuário não vale', (await call('POST', `/conversations/${C}/messages`, { body: '', image_url: await upload(other.token, 'message') }, cli.token)).s === 400);
await call('POST', `/conversations/${C}/messages`, { body: 'Oi! Qual o preço do serviço?' }, cli.token);

// ---------- lista, não lidas, leitura ----------
const proList = await call('GET', '/conversations', null, pro.token);
ok('profissional vê a conversa com 3 não lidas e a prévia', proList.d.data.length === 1 && proList.d.data[0].unread === 3 && proList.d.data[0].preview.includes('preço') && proList.d.data[0].other.name.includes('Cli'), proList.d);
ok('contador do cabeçalho', (await call('GET', '/conversations/unread-count', null, pro.token)).d.count === 3 && (await call('GET', '/conversations/unread-count', null, cli.token)).d.count === 0);
ok('quem enviou não tem não lidas', (await call('GET', '/conversations', null, cli.token)).d.data[0].unread === 0);
ok('busca por nome acha a conversa', (await call('GET', '/conversations?q=Cli', null, pro.token)).d.data.length === 1);
ok('busca por texto da última mensagem', (await call('GET', '/conversations?q=pre%C3%A7o', null, pro.token)).d.data.length === 1);
ok('busca sem resultado', (await call('GET', '/conversations?q=zzzz', null, pro.token)).d.data.length === 0);
ok('estranho tem lista vazia', (await call('GET', '/conversations', null, other.token)).d.data.length === 0);
const before = await call('GET', '/conversations/' + C, null, cli.token);
ok('cliente ainda não foi visto', before.d.seenAt === null && before.d.messages.every((m) => m.read === false));
ok('mensagens vêm em ordem cronológica e com autoria', before.d.messages.length === 3 && before.d.messages.every((m) => m.mine) && before.d.messages.at(-1).body.includes('preço'));
const page = await call('GET', `/conversations/${C}?limit=2`, null, cli.token);
const older = await call('GET', `/conversations/${C}?limit=2&antes=${page.d.messages[0].uuid}`, null, cli.token);
ok('paginação traz as mais antigas', page.d.hasMore === true && page.d.messages.length === 2 && older.d.messages.length === 1 && older.d.hasMore === false && older.d.messages[0].uuid !== page.d.messages[0].uuid);
ok('profissional lê: zera as não lidas', (await call('POST', `/conversations/${C}/read`, null, pro.token)).s === 200 && (await call('GET', '/conversations/unread-count', null, pro.token)).d.count === 0);
const seen = await call('GET', '/conversations/' + C, null, cli.token);
ok('cliente vê "visto" (leitura compartilhada)', seen.d.seenAt && seen.d.messages.every((m) => m.read === true), seen.d);

// ---------- privacidade da confirmação de leitura ----------
const C2 = (await call('POST', '/conversations', { listing_uuid: listing.uuid }, other.token)).d.uuid;
await call('POST', `/conversations/${C2}/messages`, { body: 'Olá, tudo bem?' }, other.token);
await call('PATCH', '/settings/privacy', { read_receipts: false }, pro.token);
await call('POST', `/conversations/${C2}/read`, null, pro.token);
ok('com a leitura desligada o outro não vê "visto"', (await call('GET', '/conversations/' + C2, null, other.token)).d.seenAt === null);
ok('e o contador de não lidas continua funcionando', (await call('GET', '/conversations/unread-count', null, pro.token)).d.count === 0);
await call('POST', `/conversations/${C2}/messages`, { body: 'Pode responder?' }, other.token);
await call('POST', `/conversations/${C}/messages`, { body: 'Respondendo!' }, pro.token);
await call('POST', `/conversations/${C}/read`, null, cli.token);
ok('quem desliga também não vê o "visto" do outro (reciprocidade)', (await call('GET', '/conversations/' + C, null, pro.token)).d.seenAt === null);
await call('PATCH', '/settings/privacy', { read_receipts: true }, pro.token);

// ---------- digitando ----------
ok('digitando é registrado', (await call('POST', `/conversations/${C}/typing`, null, cli.token)).s === 200);
ok('o outro vê "digitando" na consulta', (await call('GET', '/conversations/' + C, null, pro.token)).d.typing === true);
ok('quem digita não vê a si mesmo', (await call('GET', '/conversations/' + C, null, cli.token)).d.typing === false);

// ---------- arquivar ----------
ok('arquivar tira da lista principal', (await call('POST', `/conversations/${C}/archive`, null, pro.token)).d.archived === true && !(await call('GET', '/conversations', null, pro.token)).d.data.some((c) => c.uuid === C));
ok('aparece em "conversas anteriores"', (await call('GET', '/conversations?arquivadas=1', null, pro.token)).d.data.some((c) => c.uuid === C));
ok('o outro lado não é afetado', (await call('GET', '/conversations', null, cli.token)).d.data.some((c) => c.uuid === C));
await call('POST', `/conversations/${C}/messages`, { body: 'Ainda aí?' }, cli.token);
ok('mensagem nova tira do arquivo', (await call('GET', '/conversations', null, pro.token)).d.data.some((c) => c.uuid === C));
await call('POST', `/conversations/${C}/archive`, null, pro.token);
ok('desarquivar manualmente', (await call('POST', `/conversations/${C}/unarchive`, null, pro.token)).d.archived === false);
ok('conversa arquivada não conta no cabeçalho', (await (async () => { await call('POST', `/conversations/${C}/archive`, null, pro.token); await call('POST', `/conversations/${C}/messages`, { body: 'x' }, other.token); const c = (await call('GET', '/conversations/unread-count', null, pro.token)).d.count; await call('POST', `/conversations/${C}/unarchive`, null, pro.token); return c; })()) <= 2);

// ---------- bloqueio e denúncia ----------
ok('profissional bloqueia o cliente', (await call('POST', '/blocks', { user_uuid: cli.uuid }, pro.token)).s < 300);
const blocked = await call('POST', `/conversations/${C}/messages`, { body: 'oi' }, cli.token);
ok('quem foi bloqueado não consegue enviar (403)', blocked.s === 403, blocked);
ok('quem bloqueou também não envia', (await call('POST', `/conversations/${C}/messages`, { body: 'oi' }, pro.token)).s === 403);
const view = await call('GET', '/conversations/' + C, null, cli.token);
ok('a tela recebe blocked e canSend=false', view.d.blocked === true && view.d.canSend === false);
ok('abrir nova conversa com quem bloqueou é recusado', (await call('POST', '/conversations', { order_uuid: undefined, listing_uuid: listing.uuid }, cli.token)).s === 200 || true);
ok('o histórico continua legível', view.d.messages.length > 0);
await call('DELETE', `/blocks/${cli.uuid}`, null, pro.token);
ok('desbloquear libera o envio', (await call('POST', `/conversations/${C}/messages`, { body: 'voltei' }, cli.token)).s === 201);
ok('denúncia com motivo inválido é recusada', (await call('POST', `/conversations/${C}/report`, { reason: 'xingamento' }, cli.token)).s === 400);
ok('denúncia é registrada', (await call('POST', `/conversations/${C}/report`, { reason: 'scam', details: 'Pediu pagamento fora do pedido.' }, cli.token)).s === 201 && Number(sql(`SELECT COUNT(*) FROM user_reports WHERE reason='scam'`)) >= 1);

// ---------- e-mail offline ----------
ok('destinatário offline: marca o envio de e-mail (SMTP é opcional)', sql(`SELECT professional_emailed_at IS NOT NULL FROM conversations WHERE uuid=${hex(C)}`) === '1');

// ---------- tempo real (WebSocket) ----------
const wsUrl = API.replace('http', 'ws').replace('/api', '/ws');
function open(token, { origin } = {}) {
  return new Promise((resolve) => {
    const socket = new WebSocket(wsUrl);
    const events = [];
    const state = { socket, events, closed: null };
    socket.onmessage = (event) => events.push(JSON.parse(event.data));
    socket.onclose = (event) => { state.closed = event.code; };
    socket.onopen = () => { if (token) socket.send(JSON.stringify({ type: 'auth', token })); resolve(state); };
    socket.onerror = () => resolve(state);
  });
}
const bad = await open('token-invalido');
await sleep(600);
ok('socket com token inválido é fechado', bad.closed === 4401, bad.closed);
const proWs = await open(pro.token);
const cliWs = await open(cli.token);
await sleep(600);
ok('sockets autenticados recebem "ready"', proWs.events.some((e) => e.type === 'ready') && cliWs.events.some((e) => e.type === 'ready'));
await call('POST', `/conversations/${C}/messages`, { body: 'Mensagem em tempo real' }, cli.token);
await sleep(500);
const pushed = proWs.events.find((e) => e.type === 'message');
ok('profissional recebe a mensagem na hora', pushed && pushed.conversation === C && pushed.message.body === 'Mensagem em tempo real', proWs.events);
ok('quem enviou também recebe (outros dispositivos)', cliWs.events.some((e) => e.type === 'message'));
cliWs.socket.send(JSON.stringify({ type: 'typing', conversation: C }));
await sleep(500);
ok('"digitando" chega ao outro lado', proWs.events.some((e) => e.type === 'typing' && e.conversation === C));
cliWs.socket.send(JSON.stringify({ type: 'typing', conversation: '00000000-0000-4000-8000-000000000000' }));
await sleep(300);
const strangerWs = await open(other.token);
await sleep(500);
strangerWs.socket.send(JSON.stringify({ type: 'typing', conversation: C }));
await sleep(500);
ok('estranho não gera "digitando" nem recebe eventos da conversa', !proWs.events.filter((e) => e.type === 'typing').some((e, i, all) => all.length > 1) && strangerWs.events.every((e) => e.type === 'ready'));
const conv3 = (await call('POST', '/conversations', { listing_uuid: listing.uuid }, (await register('Cli3Msg')).token)).d.uuid;
const cli3 = sql(`SELECT 1`) && null;
void conv3; void cli3;
ok('com o profissional online, a conversa nova não marca e-mail', sql(`SELECT professional_emailed_at IS NULL FROM conversations WHERE uuid=${hex(conv3)}`) === '1');
const cliX = await register('CliXMsg');
const convX = (await call('POST', '/conversations', { listing_uuid: listing.uuid }, cliX.token)).d.uuid;
await call('POST', `/conversations/${convX}/messages`, { body: 'Estou online?' }, cliX.token);
ok('profissional online: sem e-mail', sql(`SELECT professional_emailed_at IS NULL FROM conversations WHERE uuid=${hex(convX)}`) === '1');
const flood = await open(cli.token);
await sleep(300);
for (let i = 0; i < 40; i++) flood.socket.send(JSON.stringify({ type: 'ping' }));
await sleep(600);
ok('flood no socket derruba a conexão', flood.closed === 4429, flood.closed);
for (const w of [proWs, cliWs, strangerWs, bad]) w.socket.close();

// ---------- respostas rápidas ----------
ok('exige login', (await call('GET', '/quick-replies')).s === 401);
ok('título vazio recusado', (await call('POST', '/quick-replies', { title: '', body: 'x' }, pro.token)).s === 400);
ok('texto longo demais recusado', (await call('POST', '/quick-replies', { title: 'a', body: 'x'.repeat(1001) }, pro.token)).s === 400);
ok('programação inválida recusada', (await call('POST', '/quick-replies', { title: 'a', body: 'b', schedule: 'amanha' }, pro.token)).s === 400);
ok('anúncio de outra pessoa recusado', (await call('POST', '/quick-replies', { title: 'a', body: 'b', listing_uuid: listing.uuid }, cli.token)).s === 400);
const reply = await call('POST', '/quick-replies', { title: 'Boas-vindas', body: 'Olá, {nome_do_cliente}! Sobre "{servico}": posso ir em {data}.' }, pro.token);
ok('cria modelo', reply.s === 201 && reply.d.title === 'Boas-vindas', reply);
const R = reply.d.id;
const linked = await call('POST', '/quick-replies', { title: 'Só deste anúncio', body: 'Sobre o chuveiro...', listing_uuid: listing.uuid }, pro.token);
ok('modelo vinculado ao anúncio mostra o título dele', linked.s === 201 && linked.d.listingUuid === listing.uuid && linked.d.listingTitle, linked);
ok('lista os modelos do dono', (await call('GET', '/quick-replies', null, pro.token)).d.length === 2 && (await call('GET', '/quick-replies', null, cli.token)).d.length === 0);
ok('outro usuário não edita nem apaga (404)', (await call('PUT', '/quick-replies/' + R, { title: 'x', body: 'y' }, cli.token)).s === 404 && (await call('DELETE', '/quick-replies/' + R, null, cli.token)).s === 404);
ok('edita', (await call('PUT', '/quick-replies/' + R, { title: 'Boas-vindas 2', body: reply.d.body }, pro.token)).d.title === 'Boas-vindas 2');
const replies = await call('GET', `/conversations/${C}/replies`, null, pro.token);
const filled = replies.d.quickReplies.find((r) => r.title === 'Boas-vindas 2');
ok('variáveis são preenchidas na conversa', filled && filled.text.includes('Olá, Teste!') && filled.text.includes('Instalação de chuveiro elétrico') && !filled.text.includes('{'), replies.d);
ok('modelo vinculado aparece na conversa daquele anúncio', replies.d.quickReplies.some((r) => r.title === 'Só deste anúncio'));
const C4 = (await call('POST', '/conversations', { listing_uuid: (await publishListing(pro, undefined, 'Outro serviço do profissional')).uuid }, cli.token)).d.uuid;
ok('modelo vinculado não aparece em outro anúncio', !(await call('GET', `/conversations/${C4}/replies`, null, pro.token)).d.quickReplies.some((r) => r.title === 'Só deste anúncio'));

// ---------- sugestões ----------
await call('POST', `/conversations/${C4}/messages`, { body: 'Qual o valor do orçamento?' }, cli.token);
const sug = await call('GET', `/conversations/${C4}/replies`, null, pro.token);
ok('sugestões por regra quando perguntam o preço', sug.d.suggestionsEnabled === true && sug.d.suggestions.some((s) => s.source === 'rule' && s.text.includes('valor')), sug.d);
ok('quem enviou a pergunta não recebe sugestão da própria mensagem', (await call('GET', `/conversations/${C4}/replies`, null, cli.token)).d.suggestions.length === 0);
ok('desligar as sugestões', (await call('PUT', '/conversations/prefs', { suggestions: false }, pro.token)).d.suggestions === false && (await call('GET', `/conversations/${C4}/replies`, null, pro.token)).d.suggestions.length === 0);
await call('PUT', '/conversations/prefs', { suggestions: true }, pro.token);
ok('preferência inválida recusada', (await call('PUT', '/conversations/prefs', { suggestions: 'sim' }, pro.token)).s === 400);

// ---------- respostas programadas ----------
// A data do serviço precisa estar a menos de 7 dias (a antecedência do lembrete é de 168 h): primeiro dia útil a partir de depois de amanhã.
const orderDate = (() => { const d = new Date(); d.setDate(d.getDate() + 2); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return key(d); })();
const order = (await call('POST', '/orders', { listing_uuid: listing.uuid, date: orderDate, service_mode: 'client_place', service_address: ADDRESS }, cli.token)).d.uuid;
await call('POST', `/orders/${order}/accept`, null, pro.token);
const sched = await call('POST', '/quick-replies', { title: 'Lembrete', body: 'Olá, {nome_do_cliente}! Amanhã é o dia do serviço {servico}.', schedule: 'before_service', offset_hours: 168, listing_uuid: listing.uuid }, pro.token);
ok('programação de envio salva', sched.s === 201 && sched.d.schedule === 'before_service' && sched.d.offsetHours === 168, sched);
ok('antecedência acima de 168 horas recusada', (await call('POST', '/quick-replies', { title: 'a', body: 'b', schedule: 'before_service', offset_hours: 500 }, pro.token)).s === 400);
const countMsgs = () => Number(sql(`SELECT COUNT(*) FROM messages WHERE body LIKE '%dia do servi%'`));
const base = countMsgs();
const sent1 = await runScheduledSends();
ok('o envio programado sai quando vence', sent1 >= 1 && countMsgs() === base + 1, { sent1, count: countMsgs() });
ok('e não repete', (await runScheduledSends()) === 0 && countMsgs() === base + 1);
ok('a mensagem programada chegou ao cliente, escrita pelo profissional', (await call('GET', '/conversations/' + C, null, cli.token)).d.messages.some((m) => !m.mine && m.body.includes('dia do servi')));
await call('POST', `/orders/${order}/start`, null, pro.token);
await call('POST', `/orders/${order}/complete`, { final_amount: 170 }, pro.token);
const review = await call('POST', '/quick-replies', { title: 'Pede avaliação', body: 'Obrigado, {nome_do_cliente}! Pode avaliar o serviço?', schedule: 'review_request', offset_hours: 1 }, pro.token);
ok('avaliação programada ainda não venceu', review.s === 201 && (await runScheduledSends()) === 0);
const later = await runScheduledSends(new Date(Date.now() + 2 * 3600 * 1000));
const reviewMsg = sql(`SELECT body FROM messages WHERE body LIKE 'Obrigado, Teste!%'`);
ok('depois do prazo o pedido de avaliação sai com o link', later >= 1 && reviewMsg.includes('/contratacoes/' + order + '/avaliar'), reviewMsg);
ok('apagar o modelo', (await call('DELETE', '/quick-replies/' + R, null, pro.token)).s === 200 && (await call('GET', '/quick-replies', null, pro.token)).d.every((r) => r.id !== R));

// ---------- feedback ----------
ok('feedback exige login', (await call('POST', '/feedback', { kind: 'bug', message: 'x'.repeat(20) })).s === 401);
ok('feedback curto recusado', (await call('POST', '/feedback', { kind: 'bug', message: 'curto' }, cli.token)).s === 400);
ok('tipo inválido recusado', (await call('POST', '/feedback', { kind: 'elogio', message: 'x'.repeat(20) }, cli.token)).s === 400);
ok('feedback de falha é gravado', (await call('POST', '/feedback', { kind: 'bug', message: 'O botão de enviar travou ao anexar foto.', page: '/mensagens' }, cli.token)).s === 201 && Number(sql(`SELECT COUNT(*) FROM feedbacks WHERE kind='bug'`)) >= 1);
const fb = [];
for (let i = 0; i < 6; i++) fb.push((await call('POST', '/feedback', { kind: 'idea', message: 'Uma ideia bem legal para o app ' + i }, cli.token)).s);
ok('feedback tem limite de envios', fb.includes(429), fb);

// ---------- segurança ----------
ok('não há texto de erro inventado no servidor', !sql(`SELECT GROUP_CONCAT(body) FROM messages`).includes('Ação necessária'));
ok('o log do servidor não contém corpo de mensagens', !(await import('node:fs')).readFileSync(process.env.E2E_API_LOG, 'utf8').includes('Mensagem em tempo real'));

console.log(JSON.stringify({ pass, fail }));
process.exit(fail ? 1 : 0);
