import { execFileSync } from 'node:child_process';
import { call, PW, makeAdmin } from '../lib/fixtures.mjs';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'ok  ' : 'FAIL') + ' ' + name + (cond ? '' : ' ' + JSON.stringify(extra).slice(0, 300))); };
const sql = (q) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '--default-character-set=utf8mb4', '-uroot', (process.env.E2E_DB ?? 'dommos_teste'), '-N', '-e', q]).toString().trim();

const a = await call('POST', '/help/assistant/questions', { question: 'meu email maria@teste.com e telefone 41 99999-8888 esqueci a senha', slug: 'esqueci-minha-senha', answered: true });
ok('registra pergunta sem login', a.s === 201 && /^[0-9a-f-]{36}$/.test(a.d.uuid), a);
ok('gravou sem dados pessoais', !sql(`SELECT question FROM help_assistant_questions ORDER BY id DESC LIMIT 1`).match(/maria|99999/));
const b = await call('POST', '/help/assistant/questions', { question: 'tem como emitir nota fiscal?', answered: false });
ok('registra pergunta sem resposta', b.s === 201);
ok('pergunta inválida é recusada', (await call('POST', '/help/assistant/questions', { question: 'x', answered: true })).s === 400);
ok('slug inválido é recusado', (await call('POST', '/help/assistant/questions', { question: 'como pagar', slug: 'x y', answered: true })).s === 400);
const r1 = await call('POST', `/help/assistant/questions/${a.d.uuid}/rating`, { helpful: false });
ok('avalia (204)', r1.s === 204, r1);
await call('POST', `/help/assistant/questions/${a.d.uuid}/rating`, { helpful: true });
ok('segunda avaliação não troca a primeira', sql(`SELECT helpful FROM help_assistant_questions WHERE answered=1 ORDER BY id DESC LIMIT 1`) === '0');
ok('código inválido não quebra', (await call('POST', '/help/assistant/questions/nao-e-uuid/rating', { helpful: true })).s === 204);

ok('relatório exige login', (await call('GET', '/admin/help-assistant')).s === 401);
const admin = await makeAdmin('Admin' + (process.env.E2E_SUITE ?? 'Teste'));
const rep = await call('GET', '/admin/help-assistant?days=30', null, admin.token);
ok('admin vê o relatório', rep.s === 200 && rep.d.total >= 2 && rep.d.unanswered.some((q) => /nota fiscal/.test(q.question)) && rep.d.notHelpful >= 1, rep.d);
const user = (await call('POST', '/auth/register', { first_name: 'Teste', last_name: 'Comum', email: `comum${Date.now()}@teste.invalid`, password: PW }));
const comum = (await call('POST', '/auth/login', { email: `comum${Date.now() - 0}@teste.invalid`, password: PW }));
ok('usuário comum não vê o relatório', comum.s !== 200 || (await call('GET', '/admin/help-assistant', null, comum.d.token)).s === 403);

let last = 0;
for (let i = 0; i < 45; i++) last = (await call('POST', '/help/assistant/questions', { question: 'pergunta numero ' + i, answered: false })).s;
ok('limite de requisições: 429 depois de 40 por hora', last === 429, last);
console.log(JSON.stringify({ pass, fail }));
process.exitCode = fail ? 1 : 0;
