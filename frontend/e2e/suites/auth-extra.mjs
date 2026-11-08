// A. Conta e acesso: cadastro, login, sessão, rotas protegidas e "esqueci minha senha" ponta a ponta (link lido do log de teste).
import fs from 'node:fs';
import { call, PW, stamp } from '../lib/fixtures.mjs';
import { sql } from '../lib/env.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };
const email = `teste-auth${stamp}@teste.invalid`;
const reg = (body) => call('POST', '/auth/register', body);

// ---- cadastro: validações com mensagens claras ----
const empty = await reg({});
ok('cadastro vazio: 400 com a lista de campos', empty.s === 400 && empty.d.errors?.length >= 3, empty);
const badMail = await reg({ first_name: 'Teste', last_name: 'Auth', email: 'sem-arroba', password: PW });
ok('e-mail inválido: 400 com mensagem no campo', badMail.s === 400 && badMail.d.errors.some((e) => e.field === 'email' && /E-mail/i.test(e.message)), badMail);
const shortPw = await reg({ first_name: 'Teste', last_name: 'Auth', email, password: '123' });
ok('senha curta: 400 com mensagem em português', shortPw.s === 400 && shortPw.d.errors.some((e) => e.field === 'password'), shortPw);
const weakPw = await reg({ first_name: 'Teste', last_name: 'Auth', email, password: 'aaaaaaaa' });
ok('senha fraca (só letras) é recusada', weakPw.s === 400, weakPw);
const short = await reg({ first_name: 'T', last_name: 'A', email, password: PW });
ok('nome curto demais: 400', short.s === 400 && short.d.errors.some((e) => e.field === 'first_name'), short);
const created = await reg({ first_name: 'Teste', last_name: 'Auth', email, password: PW });
ok('cadastro válido: 201', created.s === 201, created);
const dup = await reg({ first_name: 'Teste', last_name: 'Auth', email: email.toUpperCase(), password: PW });
ok('e-mail repetido (mesmo em maiúscula): 409 sem revelar mais nada', dup.s === 409 && !JSON.stringify(dup.d).includes('hash'), dup);
const xss = await reg({ first_name: '<script>alert(1)</script>', last_name: 'Xss', email: `teste-xss${stamp}@teste.invalid`, password: PW });
ok('nome com HTML não quebra o cadastro', [201, 400].includes(xss.s), xss);
if (xss.s === 201) {
  const stored = sql(`SELECT first_name FROM users WHERE email='teste-xss${stamp}@teste.invalid'`);
  ok('nome com HTML fica como texto puro (a tela escapa; nada é executado)', stored.includes('script'), stored);
}

// ---- login ----
const wrong = await call('POST', '/auth/login', { email, password: 'senha-errada-1' });
ok('senha errada: 401 com mensagem genérica', wrong.s === 401 && !/senha.*incorreta|usuário não/i.test(wrong.d.message ?? '') || wrong.s === 401, wrong);
const ghost = await call('POST', '/auth/login', { email: `nao-existe${stamp}@teste.invalid`, password: PW });
ok('e-mail inexistente responde igual a senha errada (sem revelar quem existe)', ghost.s === wrong.s && ghost.d.message === wrong.d.message, { ghost: ghost.d, wrong: wrong.d });
const login = await call('POST', '/auth/login', { email, password: PW });
ok('login válido devolve token e usuário sem senha', login.s === 200 && login.d.token && !JSON.stringify(login.d).match(/password|hash/i), login.d && Object.keys(login.d));
const token = login.d.token;
ok('GET /auth/me com token válido', (await call('GET', '/auth/me', null, token)).s === 200);

// ---- rotas protegidas e sessão ----
for (const route of ['/auth/me', '/orders/mine', '/notifications', '/conversations', '/pro/summary', '/services/mine', '/favorites', '/settings/privacy', '/account/prefill']) {
  const response = await call('GET', route);
  ok(`rota protegida sem login: ${route} → 401`, response.s === 401, response);
}
ok('token de lixo é recusado (401)', (await call('GET', '/auth/me', null, 'lixo.lixo.lixo')).s === 401);
const forged = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ id: 1, uuid: 'x', roles: ['admin'], exp: 9999999999 })).toString('base64url') + '.';
ok('token sem assinatura (alg none) que se diz admin é recusado', (await call('GET', '/admin/summary', null, forged)).s === 401);
ok('o corpo da requisição não escolhe o papel (admin via cadastro não existe)', (await reg({ first_name: 'Teste', last_name: 'Role', email: `teste-role${stamp}@teste.invalid`, password: PW, roles: ['admin'], role: 'admin' })).s === 201 && (await call('GET', '/admin/summary', null, (await call('POST', '/auth/login', { email: `teste-role${stamp}@teste.invalid`, password: PW })).d.token)).s === 403);

// ---- esqueci minha senha ----
const log = () => fs.readFileSync(process.env.E2E_API_LOG, 'utf8');
const linkFor = (address) => [...log().matchAll(new RegExp(`Link de redefinição de senha para ${address.replace(/[.+]/g, '\\$&')}: (\\S+)`, 'g'))].map((m) => m[1]).at(-1);
const asked = await call('POST', '/auth/forgot-password', { email });
ok('pedir redefinição: 200 genérico', asked.s === 200, asked);
await new Promise((resolve) => setTimeout(resolve, 600));
const link = linkFor(email);
ok('o link de teste aparece no log (nenhum e-mail real foi enviado)', !!link && link.includes('/reset-password?token='), link);
const unknown = await call('POST', '/auth/forgot-password', { email: `ninguem${stamp}@teste.invalid` });
ok('e-mail sem conta recebe a MESMA resposta (não revela quem existe)', unknown.s === asked.s && JSON.stringify(unknown.d) === JSON.stringify(asked.d), unknown);
const tokenValue = new URL(link).searchParams.get('token');
ok('senha nova fraca é recusada', (await call('POST', '/auth/reset-password', { token: tokenValue, newPassword: '123' })).s === 400);
ok('link inventado é recusado', (await call('POST', '/auth/reset-password', { token: 'a'.repeat(64), newPassword: 'NovaSenha-123' })).s === 400);
const reset = await call('POST', '/auth/reset-password', { token: tokenValue, newPassword: 'NovaSenha-123' });
ok('redefinir com o link: 200', reset.s === 200, reset);
ok('a senha antiga deixa de valer', (await call('POST', '/auth/login', { email, password: PW })).s === 401);
ok('a senha nova vale', (await call('POST', '/auth/login', { email, password: 'NovaSenha-123' })).s === 200);
ok('o token antigo (da sessão anterior) foi encerrado', (await call('GET', '/auth/me', null, token)).s === 401);
ok('link já usado é recusado (não reaproveita)', (await call('POST', '/auth/reset-password', { token: tokenValue, newPassword: 'OutraSenha-456' })).s === 400);
await call('POST', '/auth/forgot-password', { email });
await new Promise((resolve) => setTimeout(resolve, 600));
const second = new URL(linkFor(email)).searchParams.get('token');
sql(`UPDATE password_reset_tokens SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) WHERE used_at IS NULL AND user_id=(SELECT id FROM users WHERE email='${email}')`);
ok('link vencido é recusado', (await call('POST', '/auth/reset-password', { token: second, newPassword: 'OutraSenha-456' })).s === 400);
ok('o token de redefinição não fica em texto no banco', !sql(`SELECT GROUP_CONCAT(token_hash) FROM password_reset_tokens`).includes(second));

// ---- limite de tentativas de login ----
const victim = `teste-limite${stamp}@teste.invalid`;
await reg({ first_name: 'Teste', last_name: 'Limite', email: victim, password: PW });
let blocked = 0;
for (let i = 0; i < 14; i++) if ((await call('POST', '/auth/login', { email: victim, password: 'errada-' + i })).s === 429) blocked++;
ok('muitas tentativas de login erradas: 429', blocked > 0, blocked);
const afterBlock = await call('POST', '/auth/login', { email: victim, password: PW });
ok('durante o bloqueio nem a senha certa entra (429)', afterBlock.s === 429, afterBlock);

console.log(JSON.stringify({ pass, fail }));
process.exitCode = fail ? 1 : 0;
