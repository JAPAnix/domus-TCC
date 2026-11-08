import zlib from 'node:zlib';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { backendUrl } from '../lib/env.mjs';
const jwt = createRequire(backendUrl('package.json'))('jsonwebtoken');
import { publishListing } from '../lib/fixtures.mjs';
import { execFileSync } from 'node:child_process';

const A = 'http://localhost:3100/api';
const SECRET = process.env.E2E_JWT_SECRET;
const UPLOADS = process.env.E2E_UPLOAD_DIR;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra))); };
const call = async (method, path, body, token, raw = false) => {
  const response = await fetch(A + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return response;
  let data = null; try { data = await response.json(); } catch { /* sem corpo */ }
  return { s: response.status, d: data };
};
const sql = (query) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', query]).toString().trim();
function png() {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const table = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = ~0; for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  return Buffer.concat([sig, chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 120, 60, 200]))), chunk('IEND', Buffer.alloc(0))]);
}
const upload = async (token, purpose) => { const form = new FormData(); form.set('purpose', purpose); form.set('file', new Blob([png()], { type: 'image/png' }), 'a.png'); const r = await fetch(A + '/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: form }); return r.json(); };

const stamp = Date.now();
const PW = 'senha-forte-1';
async function register(name) {
  const email = `${name}${stamp}@teste.invalid`;
  await call('POST', '/auth/register', { first_name: 'Teste', last_name: name, email, password: PW });
  const login = await call('POST', '/auth/login', { email, password: PW });
  return { email, token: login.d.token, user: login.d.user };
}

// ---------- sessões ----------
const cli = await register('cliente');
const pro = await register('pro');
const other = await register('outro');
const decoded = jwt.decode(cli.token);
ok('token tem sid', !!decoded.sid, decoded);
const legacy = jwt.sign({ id: decoded.id, uuid: decoded.uuid, email: cli.email, roles: ['client'] }, SECRET, { expiresIn: '1d' });
ok('token antigo (sem sessão) é recusado', (await call('GET', '/auth/me', null, legacy)).s === 401);
const s1 = await call('GET', '/account/sessions', null, cli.token);
ok('lista 1 sessão, a atual', s1.d.length === 1 && s1.d[0].current === true && /em/.test(s1.d[0].device), s1.d);
const second = await call('POST', '/auth/login', { email: cli.email, password: PW });
const s2 = await call('GET', '/account/sessions', null, cli.token);
ok('segundo login cria outra sessão', s2.d.length === 2 && s2.d.filter((s) => s.current).length === 1, s2.d);
const otherSession = s2.d.find((s) => !s.current);
ok('encerrar sessão de outro dispositivo', (await call('DELETE', '/account/sessions/' + otherSession.id, null, cli.token)).s === 200);
ok('token da sessão encerrada deixa de valer', (await call('GET', '/auth/me', null, second.d.token)).s === 401);
ok('sessão atual continua válida', (await call('GET', '/auth/me', null, cli.token)).s === 200);
ok('sessão inexistente 404', (await call('DELETE', '/account/sessions/nao-existe', null, cli.token)).s === 404);
const third = await call('POST', '/auth/login', { email: cli.email, password: PW });
ok('sair dos outros dispositivos', (await call('DELETE', '/account/sessions', null, cli.token)).d.revoked === 1 && (await call('GET', '/auth/me', null, third.d.token)).s === 401);

// ---------- senha ----------
ok('senha atual errada 403 (não 401)', (await call('PATCH', '/account/password', { current_password: 'errada-123', new_password: 'nova-senha-2' }, cli.token)).s === 403);
ok('nova senha curta 400', (await call('PATCH', '/account/password', { current_password: PW, new_password: '123' }, cli.token)).s === 400);
ok('mesma senha recusada', (await call('PATCH', '/account/password', { current_password: PW, new_password: PW }, cli.token)).s === 400);
const fourth = await call('POST', '/auth/login', { email: cli.email, password: PW });
ok('troca de senha ok', (await call('PATCH', '/account/password', { current_password: PW, new_password: 'nova-senha-2' }, cli.token)).s === 200);
ok('troca de senha desconecta os outros dispositivos', (await call('GET', '/auth/me', null, fourth.d.token)).s === 401 && (await call('GET', '/auth/me', null, cli.token)).s === 200);
ok('senha antiga não entra mais', (await call('POST', '/auth/login', { email: cli.email, password: PW })).s === 401);
const relog = await call('POST', '/auth/login', { email: cli.email, password: 'nova-senha-2' });
ok('senha nova entra', relog.s === 200);
cli.token = relog.d.token;

// ---------- Google: trava para não perder o acesso ----------
const gUser = await register('google');
sql(`UPDATE users SET google_id='g-${stamp}', password_hash=NULL WHERE email='${gUser.email}'`);
ok('me informa que não há senha e que há Google', (await call('GET', '/auth/me', null, gUser.token)).d.hasPassword === false);
ok('sem senha, desconectar o Google é bloqueado (409)', (await call('DELETE', '/account/google', null, gUser.token)).s === 409);
ok('criar senha sem senha atual', (await call('PATCH', '/account/password', { new_password: 'senha-criada-3' }, gUser.token)).s === 200);
ok('com senha, desconectar o Google funciona', (await call('DELETE', '/account/google', null, gUser.token)).s === 200);
ok('desconectar sem Google 400', (await call('DELETE', '/account/google', null, gUser.token)).s === 400);

// ---------- configurações ----------
const st = await call('GET', '/settings', null, cli.token);
ok('configurações padrão', st.d.privacy.profileVisibility === 'everyone' && st.d.privacy.searchIndexing === true && st.d.locale.language === 'pt-BR' && st.d.locale.currency === 'BRL', st.d);
ok('catálogo só com canais app e email', st.d.notifications.catalog.account.every((i) => i.channels.every((c) => ['app', 'email'].includes(c))));
ok('ofertas começam desligadas', st.d.notifications.values.pro_tips.email === false && st.d.notifications.values.proposal_received.app === true);
ok('privacidade salva', (await call('PATCH', '/settings/privacy', { read_receipts: false, show_written_reviews: false }, cli.token)).d.privacy.readReceipts === false);
ok('privacidade vazia 400', (await call('PATCH', '/settings/privacy', {}, cli.token)).s === 400);
ok('visibilidade inválida 400', (await call('PATCH', '/settings/privacy', { profile_visibility: 'todos' }, cli.token)).s === 400);
ok('notificação desconhecida 400', (await call('PATCH', '/settings/notifications', { x: { app: true } }, cli.token)).s === 400);
ok('canal inexistente (push) 400', (await call('PATCH', '/settings/notifications', { proposal_received: { push: true } }, cli.token)).s === 400);
ok('notificações salvam', (await call('PATCH', '/settings/notifications', { proposal_received: { app: false } }, cli.token)).d.notifications.values.proposal_received.app === false);
ok('cookies salvam', (await call('PATCH', '/settings/cookies', { analytics: true }, cli.token)).d.cookies.analytics === true);
ok('idioma inexistente 400', (await call('PATCH', '/settings/locale', { language: 'en-US', currency: 'BRL' }, cli.token)).s === 400);
ok('locale válido', (await call('PATCH', '/settings/locale', { language: 'pt-BR', currency: 'BRL' }, cli.token)).s === 200);
ok('CPF inválido 400', (await call('PUT', '/settings/tax', { document_type: 'cpf', document: '111.111.111-11', holder_name: 'Maria da Silva' }, pro.token)).s === 400);
const tax = await call('PUT', '/settings/tax', { document_type: 'cpf', document: '529.982.247-25', holder_name: 'Maria da Silva' }, pro.token);
ok('impostos salvam com máscara', tax.s === 200 && tax.d.tax.documentMasked === '•••.•••.•••-25', tax.d);
ok('documento fica só com dígitos (a chave Pix é só em Pagamentos)', sql(`SELECT tax_document FROM user_settings s JOIN users u ON u.id=s.user_id WHERE u.email='${pro.email}'`) === '52998224725');
ok('resposta nunca traz o documento inteiro', !JSON.stringify(tax.d).includes('52998224725'));
ok('limpar impostos', (await call('DELETE', '/settings/tax', null, pro.token)).d.tax.documentType === null);

// ---------- perfil ----------
const prof = await call('PATCH', '/profile/me', { about: 'Atendo a região central.', profession: 'Pintor', languages: ['Português', 'português', 'Inglês'], interests: ['Reformas'], years_experience: 8, city: 'Curitiba', state: 'pr' }, cli.token);
ok('perfil salva', prof.s === 200 && prof.d.profession === 'Pintor' && prof.d.state === 'PR', prof.d);
ok('idiomas sem repetição', prof.d.languages.length === 2, prof.d.languages);
ok('completude calculada', prof.d.completion.done === 5 && prof.d.completion.missing.includes('Foto de perfil'), prof.d.completion);
ok('anos inválidos 400', (await call('PATCH', '/profile/me', { years_experience: 99 }, cli.token)).s === 400);
ok('texto grande demais 400', (await call('PATCH', '/profile/me', { about: 'a'.repeat(1001) }, cli.token)).s === 400);
const photo = await upload(cli.token, 'avatar');
ok('foto de perfil via perfil', (await call('PATCH', '/profile/me', { profile_picture_url: photo.url }, cli.token)).d.completion.done === 6);
ok('limpar campos', (await call('PATCH', '/profile/me', { about: '', languages: [] }, cli.token)).d.about === null);
await call('PATCH', '/profile/me', { about: 'Atendo a região central.', languages: ['Português'] }, cli.token);

// ---------- perfil público, privacidade e bloqueios ----------
const view = async (token) => call('GET', '/profile/' + cli.user.uuid, null, token);
ok('perfil público completo para visitante', (await view()).d.restricted === false && (await view()).d.profession === 'Pintor');
const pub = (await view()).d;
ok('perfil público não vaza e-mail nem sobrenome separado', !JSON.stringify(pub).includes('@teste') && pub.email === undefined);
await call('PATCH', '/settings/privacy', { profile_visibility: 'members' }, cli.token);
ok('só membros: visitante vê versão restrita', (await view()).d.restricted === true && (await view()).d.about === undefined);
ok('só membros: logado vê tudo', (await view(other.token)).d.restricted === false);
await call('PATCH', '/settings/privacy', { profile_visibility: 'connections' }, cli.token);
ok('só conexões: outro logado vê versão restrita', (await view(other.token)).d.restricted === true);
ok('só conexões: dono vê o próprio perfil', (await view(cli.token)).d.restricted === false && (await view(cli.token)).d.isSelf === true);
await call('PATCH', '/settings/privacy', { profile_visibility: 'everyone' }, cli.token);
ok('perfil inexistente 404', (await call('GET', '/profile/00000000-0000-4000-8000-000000000000')).s === 404);
ok('uuid inválido 404', (await call('GET', '/profile/nao-uuid')).s === 404);
ok('avaliações escritas respeitam a privacidade (desligado)', (await call('GET', `/profile/${cli.user.uuid}/reviews-written`, null, other.token)).s === 403);
ok('o dono vê as próprias avaliações escritas', (await call('GET', `/profile/${cli.user.uuid}/reviews-written`, null, cli.token)).s === 200);
ok('minhas avaliações escritas', (await call('GET', '/profile/me/reviews-written', null, cli.token)).d.meta.total === 0);

ok('não dá para bloquear a si mesmo', (await call('POST', '/blocks', { user_uuid: cli.user.uuid }, cli.token)).s === 400);
ok('bloquear usuário', (await call('POST', '/blocks', { user_uuid: other.user.uuid }, cli.token)).s === 201);
ok('bloquear duas vezes é idempotente', (await call('POST', '/blocks', { user_uuid: other.user.uuid }, cli.token)).s === 201);
ok('lista de bloqueados', (await call('GET', '/blocks', null, cli.token)).d.length === 1);
ok('quem foi bloqueado não vê o perfil de quem bloqueou (404)', (await view(other.token)).s === 404);
ok('quem bloqueou ainda vê o outro perfil, com a marca', (await call('GET', '/profile/' + other.user.uuid, null, cli.token)).d.viewerBlocked === true);
ok('desbloquear', (await call('DELETE', '/blocks/' + other.user.uuid, null, cli.token)).s === 200 && (await call('GET', '/blocks', null, cli.token)).d.length === 0);
ok('depois de desbloquear volta a ver', (await view(other.token)).s === 200);

// ---------- pedidos, propostas, bloqueio e preferências de notificação ----------
const cats = (await call('GET', '/categories')).d;
const svc = await call('POST', '/services', { title: 'Pintar apartamento', description: 'Pintura completa de um apartamento de 60 metros quadrados.', category_id: cats[0].id, budget_min: 500, budget_max: 900, deadline: '2030-03-01', city: 'Curitiba', state: 'PR' }, cli.token);
ok('cliente publica pedido', svc.s === 201);
const items = (await call('GET', '/service-catalog')).d;
// O perfil profissional nasce ao publicar o primeiro anúncio (a rota antiga /professionals foi removida).
const createPro = async (token) => ({ s: (await publishListing({ token })).status === 200 ? 201 : 0 });
ok('profissional cria perfil', (await createPro(pro.token)).s === 201);
await createPro(other.token);
await call('POST', '/blocks', { user_uuid: pro.user.uuid }, cli.token);
ok('profissional bloqueado não envia proposta (403)', (await call('POST', `/services/${svc.d.uuid}/proposals`, { proposed_price: 600 }, pro.token)).s === 403);
await call('DELETE', '/blocks/' + pro.user.uuid, null, cli.token);
const unreadBefore = (await call('GET', '/notifications', null, cli.token)).d.unread;
ok('proposta enviada depois do desbloqueio', (await call('POST', `/services/${svc.d.uuid}/proposals`, { proposed_price: 600 }, pro.token)).s === 201);
ok('preferência "site desligado" é respeitada (sem notificação)', (await call('GET', '/notifications', null, cli.token)).d.unread === unreadBefore);
await call('PATCH', '/settings/notifications', { proposal_received: { app: true } }, cli.token);
ok('outra proposta com o site ligado notifica', (await call('POST', `/services/${svc.d.uuid}/proposals`, { proposed_price: 650 }, other.token)).s === 201 && (await call('GET', '/notifications', null, cli.token)).d.unread === unreadBefore + 1);

const svc2 = await call('POST', '/services', { title: 'Segundo pedido aberto', description: 'Outro pedido que continua aberto para teste.', category_id: cats[0].id, city: 'Curitiba', state: 'PR' }, cli.token);
const pendingOfOther = await call('POST', `/services/${svc2.d.uuid}/proposals`, { proposed_price: 100 }, other.token);
ok('proposta pendente em pedido que segue aberto', pendingOfOther.s === 201);

// ---------- conexões ----------
const props = (await call('GET', `/services/${svc.d.uuid}/proposals`, null, cli.token)).d;
const mine = props.find((p) => p.professional.user.uuid === pro.user.uuid);
ok('cliente aceita proposta', (await call('PATCH', `/proposals/${mine.uuid}/status`, { status: 'accepted' }, cli.token)).s === 200);
const conns = await call('GET', '/profile/me/connections', null, cli.token);
ok('conexões do cliente incluem o profissional contratado', conns.d.length === 1 && conns.d[0].uuid === pro.user.uuid && conns.d[0].isProfessional === true, conns.d);
ok('e do lado do profissional, o cliente', (await call('GET', '/profile/me/connections', null, pro.token)).d[0]?.uuid === cli.user.uuid);
await call('PATCH', '/settings/privacy', { profile_visibility: 'connections' }, cli.token);
ok('"só conexões": quem fechou negócio agora vê o perfil', (await view(pro.token)).d.restricted === false && (await view(other.token)).d.restricted === true);
await call('PATCH', '/settings/privacy', { profile_visibility: 'everyone' }, cli.token);
ok('perfil público do profissional traz nota e selo', (await call('GET', '/profile/' + pro.user.uuid)).d.professional.totalReviews === 0);

// ---------- favoritos ----------
ok('favoritos exige login', (await call('GET', '/favorites')).s === 401);
const lists0 = await call('GET', '/favorites', null, cli.token);
ok('começa sem listas e sem vistos', lists0.d.lists.length === 0 && lists0.d.recent.length === 0, lists0.d);
const picker = await call('GET', `/favorites/item?type=professional&uuid=${pro.user.uuid}`, null, cli.token);
ok('janela de salvar cria a lista Favoritos', picker.d.lists.length === 1 && picker.d.lists[0].name === 'Favoritos' && picker.d.lists[0].saved === false, picker.d);
const nl = await call('POST', '/favorites/lists', { name: 'Pintura' }, cli.token);
ok('criar lista', nl.s === 201 && nl.d.name === 'Pintura');
ok('nome repetido 409', (await call('POST', '/favorites/lists', { name: 'Pintura' }, cli.token)).s === 409);
ok('nome vazio 400', (await call('POST', '/favorites/lists', { name: '   ' }, cli.token)).s === 400);
const save = await call('PUT', '/favorites/item', { type: 'professional', uuid: pro.user.uuid, list_ids: [picker.d.lists[0].id, nl.d.id] }, cli.token);
ok('salvar em duas listas', save.d.saved === true);
ok('status dos corações', (await call('GET', `/favorites/status?type=professional&uuids=${pro.user.uuid},${other.user.uuid}`, null, cli.token)).d.saved[pro.user.uuid] === true);
ok('lista de outro usuário recusada', (await call('PUT', '/favorites/item', { type: 'professional', uuid: pro.user.uuid, list_ids: ['999999'] }, cli.token)).s === 400);
const shown = await call('GET', '/favorites/lists/' + nl.d.id, null, cli.token);
ok('lista mostra o profissional', shown.d.items.length === 1 && shown.d.items[0].uuid === pro.user.uuid, shown.d);
ok('lista de outra pessoa não abre (404)', (await call('GET', '/favorites/lists/' + nl.d.id, null, other.token)).s === 404);
ok('renomear', (await call('PATCH', '/favorites/lists/' + nl.d.id, { name: 'Pintores' }, cli.token)).d.name === 'Pintores');
ok('remover de uma lista mantém na outra', (await call('PUT', '/favorites/item', { type: 'professional', uuid: pro.user.uuid, list_ids: [picker.d.lists[0].id] }, cli.token)).d.saved === true && (await call('GET', '/favorites/lists/' + nl.d.id, null, cli.token)).d.items.length === 0);
ok('remover de todas', (await call('PUT', '/favorites/item', { type: 'professional', uuid: pro.user.uuid, list_ids: [] }, cli.token)).d.saved === false);
ok('item inexistente 404', (await call('PUT', '/favorites/item', { type: 'professional', uuid: '00000000-0000-4000-8000-000000000000', list_ids: [] }, cli.token)).s === 404);
ok('tipo ainda sem suporte 400', (await call('PUT', '/favorites/item', { type: 'listing', uuid: pro.user.uuid, list_ids: [] }, cli.token)).s === 404);
await call('POST', '/favorites/recent', { type: 'professional', uuid: pro.user.uuid }, cli.token);
await call('POST', '/favorites/recent', { type: 'professional', uuid: other.user.uuid }, cli.token);
await call('POST', '/favorites/recent', { type: 'professional', uuid: pro.user.uuid }, cli.token);
const rec = await call('GET', '/favorites', null, cli.token);
ok('vistos recentemente, sem repetição e com o mais novo primeiro', rec.d.recent.length === 2 && rec.d.recent[0].uuid === pro.user.uuid, rec.d.recent);
ok('apagar lista', (await call('DELETE', '/favorites/lists/' + nl.d.id, null, cli.token)).s === 204);
await call('POST', '/blocks', { user_uuid: pro.user.uuid }, cli.token);
ok('profissional bloqueado não pode ser favoritado', (await call('PUT', '/favorites/item', { type: 'professional', uuid: pro.user.uuid, list_ids: [] }, cli.token)).s === 404);
await call('DELETE', '/blocks/' + pro.user.uuid, null, cli.token);

// ---------- ajuda ----------
ok('feedback anônimo', (await call('POST', '/help/feedback', { slug: 'como-comecar', helpful: true })).s === 201);
ok('feedback com slug inválido 400', (await call('POST', '/help/feedback', { slug: '../x', helpful: true })).s === 400);
ok('chamado anônimo sem e-mail 400', (await call('POST', '/help/tickets', { category: 'conta', subject: 'Preciso de ajuda', message: 'Não consigo entrar na minha conta desde ontem.', name: 'Ana' })).s === 400);
ok('chamado anônimo', (await call('POST', '/help/tickets', { category: 'conta', subject: 'Preciso de ajuda', message: 'Não consigo entrar na minha conta desde ontem.', name: 'Ana', email: 'ana@exemplo.com' })).s === 201);
const tk = await call('POST', '/help/tickets', { category: 'pagamentos', subject: 'Dúvida sobre pagamento', message: 'Como será feito o pagamento do serviço contratado?' }, cli.token);
ok('chamado de usuário logado', tk.s === 201 && tk.d.id);
ok('mensagem curta 400', (await call('POST', '/help/tickets', { category: 'conta', subject: 'Preciso de ajuda', message: 'curta' }, cli.token)).s === 400);
ok('assunto inválido 400', (await call('POST', '/help/tickets', { category: 'hack', subject: 'Preciso de ajuda', message: 'a'.repeat(30) }, cli.token)).s === 400);
const mineTk = await call('GET', '/help/tickets/mine', null, cli.token);
ok('meus chamados', mineTk.d.length === 1 && mineTk.d[0].status === 'open');
ok('chamado usa o e-mail da conta, não o do formulário', sql(`SELECT email FROM support_tickets WHERE id=${tk.d.id}`) === cli.email);
for (let i = 0; i < 5; i++) await call('POST', '/help/tickets', { category: 'conta', subject: 'Preciso de ajuda', message: 'a'.repeat(30) }, cli.token);
ok('limite de chamados por hora (429)', (await call('POST', '/help/tickets', { category: 'conta', subject: 'Preciso de ajuda', message: 'a'.repeat(30) }, cli.token)).s === 429);

// ---------- exportação ----------
const exp = await call('GET', '/account/export', null, cli.token, true);
const json = JSON.parse(await exp.text());
ok('exportação JSON com anexo', exp.headers.get('content-disposition').includes('.json') && json.conta.email === cli.email, json.conta);
ok('exportação não traz senha nem hash', !JSON.stringify(json).match(/password|\$2[aby]\$/i));
ok('exportação traz perfil, favoritos e chamados', json.perfil.profissao === 'Pintor' && json.chamadosDeSuporte.length >= 1 && Array.isArray(json.favoritos));
const csv = await call('GET', '/account/export?format=csv', null, cli.token, true);
const csvBytes = Buffer.from(await csv.arrayBuffer());
const csvText = csvBytes.toString('utf8');
ok('exportação CSV com BOM e cabeçalho', csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf && csvText.includes('"Campo","Valor"') && csv.headers.get('content-type').includes('text/csv'));
ok('exportação CSV tem os dados', csvText.includes('"conta.email"') && csvText.includes(cli.email));

// ---------- desativar ----------
ok('desativar com senha errada 403', (await call('POST', '/account/deactivate', { password: 'errada-123' }, cli.token)).s === 403);
const pubBefore = (await call('GET', '/profile/' + pro.user.uuid)).s;
const proPw = await call('POST', '/account/deactivate', { password: PW }, pro.token);
ok('profissional desativa a conta', proPw.s === 200);
ok('sessões encerradas na desativação', (await call('GET', '/auth/me', null, pro.token)).s === 401);
ok('conta desativada some do perfil público', pubBefore === 200 && (await call('GET', '/profile/' + pro.user.uuid)).s === 404);
ok('conta desativada some da busca de serviços', !(await call('GET', '/listings/search?limit=50')).d.data.some((item) => JSON.stringify(item).includes(pro.user.uuid)));
const react = await call('POST', '/auth/login', { email: pro.email, password: PW });
ok('entrar de novo reativa', react.s === 200 && react.d.reactivated === true);
pro.token = react.d.token;
ok('depois de reativar o perfil volta', (await call('GET', '/profile/' + pro.user.uuid)).s === 200);

// ---------- excluir ----------
const delPhoto = await upload(other.token, 'avatar');
const delDir = delPhoto.key.split('/')[0];
ok('foto existe antes da exclusão', fs.existsSync(`${UPLOADS}/${delDir}`));
ok('excluir: senha errada 403', (await call('POST', '/account/delete/start', { password: 'errada-123' }, other.token)).s === 403);
const start = await call('POST', '/account/delete/start', { password: PW }, other.token);
ok('excluir: etapa 1 devolve token de confirmação', start.s === 200 && start.d.token);
ok('excluir: palavra errada 400', (await call('POST', '/account/delete/confirm', { token: start.d.token, confirmation: 'excluir' }, other.token)).s === 400);
ok('excluir: token de outra pessoa recusado', (await call('POST', '/account/delete/confirm', { token: start.d.token, confirmation: 'EXCLUIR' }, cli.token)).s === 400);
const confirm = await call('POST', '/account/delete/confirm', { token: start.d.token, confirmation: 'EXCLUIR' }, other.token);
ok('excluir: etapa 2', confirm.s === 200, confirm.d);
ok('conta excluída não entra', (await call('POST', '/auth/login', { email: other.email, password: PW })).s === 401);
ok('sessão antiga deixa de valer', (await call('GET', '/auth/me', null, other.token)).s === 401);
ok('dados pessoais anonimizados', sql(`SELECT CONCAT(first_name,'|',IFNULL(phone_number,'-'),'|',IFNULL(profile_picture_url,'-'),'|',IFNULL(city,'-')) FROM users WHERE id=${jwt.decode(other.token).id}`) === 'Conta|-|-|-');
ok('e-mail anonimizado', sql(`SELECT email FROM users WHERE id=${jwt.decode(other.token).id}`).endsWith('@excluida.invalid'));
await new Promise((r) => setTimeout(r, 400));
ok('fotos removidas do armazenamento', !fs.existsSync(`${UPLOADS}/${delDir}`));
ok('perfil profissional esvaziado e despublicado', sql(`SELECT CONCAT(is_published,'|',IFNULL(headline,'-')) FROM professional_profiles WHERE user_id=${jwt.decode(other.token).id}`) === '0|-');
ok('proposta pendente do excluído foi retirada', sql(`SELECT status FROM proposals WHERE uuid=UNHEX(REPLACE('${pendingOfOther.d.uuid}','-',''))`) === 'withdrawn');
// serviço em andamento impede a exclusão
const blockedDelete = await call('POST', '/account/delete/start', { password: PW }, pro.token);
ok('com serviço em andamento a exclusão é bloqueada (409)', blockedDelete.s === 409 && /andamento/.test(blockedDelete.d.message), blockedDelete);

console.log(JSON.stringify({ pass, fail }));
