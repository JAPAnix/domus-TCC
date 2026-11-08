// Orquestrador do teste de ponta a ponta. Uso (na pasta frontend): npm run test:e2e
//
// O que faz: sobe um MariaDB descartável (ou reaproveita o da porta 3307), recria o banco "dommos_teste", aplica as migrations,
// roda cada suíte de API com uma API nova (zera os limites de requisição), sobe o front compilado, roda os testes de navegador
// (Playwright com o Edge instalado) e gera e2e/report/index.html.
//
// Segurança: NUNCA lê o .env do projeto. A API de teste recebe só as variáveis definidas aqui; o banco é sempre local e "dommos_teste".
// Nada de e-mail ou SMS reais (sem provedor configurado), pagamento só manual ou Asaas simulado.
//
// Variáveis opcionais: E2E_REPEAT=n (repete cada teste de navegador n vezes, para caçar instabilidade), E2E_UI_SPEC=trecho (só os arquivos de navegador cujo nome contém o trecho), E2E_SKIP_PREP=1 (pula a criação do banco, para rodar uma suíte avulsa), E2E_ONLY=trecho (roda só suítes cujo nome contém o trecho), E2E_SKIP_UI=1, E2E_KEEP_DB=1 (não recria o banco).
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { backendDir, frontendDir, e2eDir as here, DB_NAME, MYSQL_DIR, PORTS, API_URL } from './lib/env.mjs';

if (process.env.NODE_ENV === 'production') { console.error('Recusado: o teste de ponta a ponta nunca roda com NODE_ENV=production.'); process.exit(2); }
if (!/^dommos_teste/.test(DB_NAME)) { console.error(`Recusado: o banco precisa se chamar "dommos_teste*" (recebido: ${DB_NAME}).`); process.exit(2); }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tmp = path.join(os.tmpdir(), 'dommos-e2e');
const dataDir = process.env.E2E_DATA_DIR ?? path.join(tmp, 'mariadb-data');
const uploadsDir = path.join(tmp, 'uploads');
const logsDir = path.join(here, 'report', 'logs');
const outDir = path.join(tmp, 'web-dist');
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });

// Ambiente mínimo: nenhuma variável do usuário (nem do .env) vaza para os processos de teste.
const SYSTEM = ['PATH', 'Path', 'SystemRoot', 'windir', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ComSpec', 'PATHEXT', 'HOMEDRIVE', 'HOMEPATH', 'ProgramFiles', 'ProgramFiles(x86)', 'NUMBER_OF_PROCESSORS'];
const baseEnv = Object.fromEntries(SYSTEM.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
let currentDb = DB_NAME;
const dbUrlFor = (name) => `mysql://root@127.0.0.1:${PORTS.db}/${name}`;
const jwtSecret = `teste-local-${crypto.randomBytes(12).toString('hex')}`;
const secretsKey = crypto.randomBytes(32).toString('base64');
const apiEnv = (extra = {}, logFile) => ({
  ...baseEnv, NODE_ENV: 'development', PORT: String(PORTS.api),
  DATABASE_HOST: '127.0.0.1', DATABASE_PORT: String(PORTS.db), DATABASE_USER: 'root', DATABASE_PASSWORD: '', DATABASE_NAME: currentDb, DATABASE_URL: dbUrlFor(currentDb),
  JWT_SECRET: jwtSecret, FRONTEND_URL: `http://localhost:${PORTS.web}`, STORAGE_PROVIDER: 'local', UPLOAD_DIR: uploadsDir, PUBLIC_BASE_URL: `http://localhost:${PORTS.api}`,
  PAYMENT_PROVIDER: 'manual', E2E_API_LOG: logFile, ...extra,
});

const portOpen = (port) => new Promise((resolve) => { const socket = net.connect(port, '127.0.0.1'); socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false)); });
const waitPort = async (port, ms = 40000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await portOpen(port)) return true; await sleep(400); } return false; };
const kill = (child) => { if (child?.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); };
const mysql = (args, input) => execFileSync(`${MYSQL_DIR}/mysql.exe`, ['-h127.0.0.1', `-P${PORTS.db}`, '-uroot', '--default-character-set=utf8mb4', ...args], { input }).toString();

const results = []; // { group, name, ok, fail, failures, code, ms, kind }
const record = (entry) => { results.push(entry); console.log(`${entry.fail || entry.code ? 'FALHOU' : 'passou '}  ${entry.group} / ${entry.name}  (${entry.ok} ok, ${entry.fail} falhas, ${Math.round(entry.ms / 1000)} s)`); };

// ---------- banco ----------
async function ensureDb() {
  if (!(await portOpen(PORTS.db))) {
    if (!fs.existsSync(path.join(dataDir, 'mysql'))) {
      console.log('Criando o banco descartável em', dataDir);
      fs.mkdirSync(dataDir, { recursive: true });
      execFileSync(`${MYSQL_DIR}/mysql_install_db.exe`, [`--datadir=${dataDir}`], { stdio: 'ignore' });
    }
    const child = spawn(`${MYSQL_DIR}/mysqld.exe`, [`--datadir=${dataDir}`, `--port=${PORTS.db}`, '--bind-address=127.0.0.1', '--innodb-log-file-size=5M', '--innodb-buffer-pool-size=48M', '--innodb-file-per-table=1', '--skip-log-bin', '--console'], { stdio: 'ignore', detached: true });
    child.unref();
    if (!(await waitPort(PORTS.db, 60000))) throw new Error('O MariaDB de teste não subiu.');
    await sleep(2500);
  }
  await prepareDatabase(DB_NAME, !process.env.E2E_KEEP_DB);
}

/** Cria (ou recria) um banco de teste, aplica as migrations e carrega o catálogo. Nunca mexe em banco que não seja "dommos_teste*". */
async function prepareDatabase(name, recreate = true, generate = true) {
  if (!/^dommos_teste/.test(name)) throw new Error(`Banco fora do padrão dommos_teste: ${name}`);
  if (recreate) mysql([], `DROP DATABASE IF EXISTS ${name}; CREATE DATABASE ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  const run = (args, label) => {
    const out = spawnSync('npx', args, { cwd: backendDir, env: { ...baseEnv, DATABASE_URL: dbUrlFor(name) }, shell: true, encoding: 'utf8' });
    if (out.status !== 0) throw new Error(`${label} falhou:
${out.stdout}
${out.stderr}`);
    return out.stdout;
  };
  const deploy = run(['prisma', 'migrate', 'deploy'], 'migrate deploy');
  // Trava de segurança: confirma que as migrations foram para o banco de teste e não para outro.
  if (!deploy.includes(name)) throw new Error(`As migrations NÃO apontaram para ${name}. Abortado por segurança.
${deploy}`);
  if (generate) run(['prisma', 'generate'], 'prisma generate');
  // Catálogo de categorias e serviços (mesmo seed da instalação).
  const previous = currentDb;
  currentDb = name;
  const seed = spawnSync('node', ['prisma/seed.js'], { cwd: backendDir, env: apiEnv({}, ''), encoding: 'utf8' });
  currentDb = previous;
  if (seed.status !== 0) throw new Error(`seed do catálogo falhou:
${seed.stdout}
${seed.stderr}`);
}

// ---------- API ----------
async function startApi(name, extra = {}, port = PORTS.api) {
  const logFile = path.join(logsDir, `api-${name.replace(/\W+/g, '-')}.log`);
  fs.writeFileSync(logFile, '');
  const fd = fs.openSync(logFile, 'a');
  const child = spawn('node', ['src/app.js'], { cwd: backendDir, env: { ...apiEnv(extra, logFile), PORT: String(port) }, stdio: ['ignore', fd, fd] });
  const end = Date.now() + 40000;
  while (Date.now() < end) {
    try { const response = await fetch(`http://localhost:${port}/health`); if (response.ok) return { child, logFile }; } catch { /* ainda subindo */ }
    await sleep(400);
  }
  kill(child);
  throw new Error(`A API não subiu (veja ${logFile}).`);
}

// ---------- suítes de API (cada uma é um script que imprime "ok ..." e "FAIL ...") ----------
function parseChecks(text) {
  const lines = text.split(/\r?\n/);
  const oks = lines.filter((line) => /^ok {2}/.test(line)).length;
  const fails = lines.filter((line) => /^FAIL/.test(line));
  return { ok: oks, fails };
}

async function runScript(group, file, { env = {}, args = [], logFile, stage = 'manual', extraApi = {}, secondApi } = {}) {
  const name = file.replace(/\.mjs$/, '');
  const api = await startApi(`${name}`, { ...extraApi });
  const second = secondApi ? await startApi(`${name}-2`, secondApi.env, secondApi.port) : null;
  const started = Date.now();
  const out = spawnSync('node', [path.join(here, 'suites', file), ...args.map((arg) => (arg === '@log' ? api.logFile : arg))], {
    cwd: path.join(here, 'suites'), env: { ...baseEnv, E2E_API_LOG: api.logFile, E2E_DB: DB_NAME, E2E_DB_PORT: String(PORTS.db), E2E_MYSQL: `${MYSQL_DIR}/mysql.exe`, E2E_API_PORT: String(PORTS.api), E2E_JWT_SECRET: jwtSecret, E2E_UPLOAD_DIR: uploadsDir, ...env }, encoding: 'utf8', timeout: 400000, maxBuffer: 50 * 1024 * 1024,
  });
  const text = `${out.stdout ?? ''}\n${out.stderr ?? ''}`;
  fs.writeFileSync(path.join(logsDir, `suite-${name}.txt`), text);
  kill(api.child); if (second) kill(second.child);
  await sleep(700);
  const { ok, fails } = parseChecks(text);
  const crashed = out.status !== 0 && fails.length === 0;
  record({ group, name, ok, fail: fails.length + (crashed ? 1 : 0), failures: crashed ? [`o script terminou com erro (código ${out.status}); veja suite-${name}.txt`] : fails, code: out.status, ms: Date.now() - started, kind: 'api', stage });
}

const API_SUITES = [
  ['A. Conta e acesso', 'conta-sessoes.mjs'], ['A. Conta e acesso', 'auth-extra.mjs'], ['A. Conta e acesso', 'dados-cadastro.mjs'], ['A. Conta e acesso', 'uploads.mjs'],
  ['B. Descoberta', 'catalogo-favoritos.mjs'], ['B. Descoberta', 'pagina-servico-reserva.mjs'],
  ['C. Pedido por anúncio e pagamento', 'endereco-pedido.mjs'], ['C. Pedido por anúncio e pagamento', 'pagamento-direto.mjs'], ['C. Pedido por anúncio e pagamento', 'pedido-anuncio-proposta.mjs'],
  ['D. Pedido aberto', 'pedido-aberto.mjs'],
  ['E. Mensagens e notificações', 'mensagens-completo.mjs'], ['E. Mensagens e notificações', 'mensagens-leitura.mjs'], ['E. Mensagens e notificações', 'notificacoes.mjs'],
  ['F. Painel do profissional', 'anuncios-profissional.mjs'],
  ['G. Admin', 'admin-rotas.mjs'], ['G. Admin', 'assistente-ajuda.mjs'],
  ['H. Segurança', 'seguranca-autorizacao.mjs'], ['H. Segurança', 'seguranca-extra.mjs'],
];
const only = (process.env.E2E_ONLY ?? '').toLowerCase();
const wanted = (name) => !only || name.toLowerCase().includes(only);

// ---------- navegador ----------
async function runUi() {
  if (process.env.E2E_SKIP_UI) return;
  console.log('Compilando o front para o teste de navegador...');
  const build = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--mode', 'development'], { cwd: frontendDir, env: { ...baseEnv, VITE_API_URL: API_URL }, shell: true, encoding: 'utf8' });
  if (build.status !== 0) { record({ group: 'I. Interface', name: 'build do front', ok: 0, fail: 1, failures: [build.stdout.slice(-600)], code: build.status, ms: 0, kind: 'ui' }); return; }
  const preview = spawn('npx', ['vite', 'preview', '--outDir', outDir, '--port', String(PORTS.web), '--strictPort', '--host', '127.0.0.1'], { cwd: frontendDir, env: baseEnv, shell: true, stdio: 'ignore' });
  if (!(await waitPort(PORTS.web, 30000))) { kill(preview); record({ group: 'I. Interface', name: 'servidor do front', ok: 0, fail: 1, failures: ['o front compilado não subiu'], code: 1, ms: 0, kind: 'ui' }); return; }
  // Os testes de navegador usam um banco só deles (recém-criado): as listas só têm os dados do seed e do próprio teste.
  currentDb = `${DB_NAME}_ui`;
  await prepareDatabase(currentDb, true, false);   // o cliente do Prisma já foi gerado na preparação do banco principal
  const api = await startApi('ui');
  // Dados de teste (admin, clientes, profissionais, serviços, avaliações e favoritos) criados pela API.
  const seed = spawnSync('node', [path.join(here, 'seed.mjs')], { cwd: here, env: { ...baseEnv, E2E_DB: currentDb, E2E_DB_PORT: String(PORTS.db), E2E_MYSQL: `${MYSQL_DIR}/mysql.exe`, E2E_API_PORT: String(PORTS.api) }, encoding: 'utf8', timeout: 300000 });
  fs.writeFileSync(path.join(logsDir, 'seed.txt'), `${seed.stdout}\n${seed.stderr}`);
  if (seed.status !== 0) { kill(api.child); kill(preview); record({ group: 'I. Interface', name: 'seed de teste', ok: 0, fail: 1, failures: [seed.stderr.slice(-500) || seed.stdout.slice(-500)], code: seed.status, ms: 0, kind: 'ui' }); return; }
  // A API reinicia para zerar os limites de requisição antes dos testes de navegador.
  kill(api.child); await sleep(800);
  const uiEnv = { ...baseEnv, E2E_DB: currentDb, E2E_DB_PORT: String(PORTS.db), E2E_MYSQL: `${MYSQL_DIR}/mysql.exe`, E2E_API_PORT: String(PORTS.api), E2E_WEB_PORT: String(PORTS.web) };
  const playwright = (label, extraEnv, jsonName, apiLog, specFile) => {
    const started = Date.now();
    const jsonFile = path.join(here, 'report', jsonName);
    const run = spawnSync('npx', ['playwright', 'test', '-c', path.join(here, 'playwright.config.mjs'), ...(specFile ? [`e2e/ui/${specFile}`] : []), ...(process.env.E2E_REPEAT ? [`--repeat-each=${process.env.E2E_REPEAT}`] : [])], {
      cwd: frontendDir, shell: true, encoding: 'utf8', timeout: 2400000, maxBuffer: 100 * 1024 * 1024,
      env: { ...uiEnv, E2E_API_LOG: apiLog, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile, ...extraEnv },
    });
    fs.writeFileSync(path.join(logsDir, `playwright-${label.replace(/\W+/g, '-')}.txt`), `${run.stdout}\n${run.stderr}`);
    try {
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      // Um cenário por tamanho de tela: o mesmo teste conta uma vez em cada projeto (375, 768, 1280).
      const tests = [];
      const walk = (suite, trail = []) => { for (const spec of suite.specs ?? []) for (const test of spec.tests) tests.push({ title: [...trail, spec.title].join(' › '), project: test.projectName, status: test.results?.at(-1)?.status ?? 'skipped', error: (test.results?.at(-1)?.error?.message ?? '').replace(new RegExp(String.fromCharCode(27) + '\[[0-9;]*m', 'g'), '').split('\n').filter(Boolean).slice(0, 2).join(' ') }); for (const child of suite.suites ?? []) walk(child, [...trail, child.title]); };
      for (const suite of data.suites) walk(suite, []);
      const failed = tests.filter((test) => test.status !== 'passed');
      record({ group: label, name: `${tests.length} execuções (cenários x tamanhos de tela)`, ok: tests.length - failed.length, fail: failed.length, failures: failed.map((test) => `[${test.project}] ${test.title}: ${test.error}`), code: run.status, ms: Date.now() - started, kind: 'ui' });
    } catch {
      record({ group: label, name: 'execução', ok: 0, fail: 1, failures: [`sem resultado do Playwright (código ${run.status}); veja playwright-${label}.txt`], code: run.status, ms: Date.now() - started, kind: 'ui' });
    }
  };
  // Uma API nova por arquivo de teste: zera os limites de requisição (cadastro e login) entre os arquivos.
  fs.rmSync(path.join(here, '.sessions.json'), { force: true });
  const specs = fs.readdirSync(path.join(here, 'ui')).filter((file) => file.endsWith('.spec.mjs') && file !== 'asaas.spec.mjs' && (!process.env.E2E_UI_SPEC || file.includes(process.env.E2E_UI_SPEC))).sort();
  for (const file of specs) {
    const ui = await startApi(`ui-${file.replace('.spec.mjs', '')}`);
    playwright(`I. Interface: ${file.replace('.spec.mjs', '')}`, {}, `playwright-${file.replace('.spec.mjs', '')}.json`, ui.logFile, file);
    kill(ui.child); await sleep(800);
  }
  // Pagamento pelo Asaas simulado, pela interface: a API sobe no modo Asaas e o próprio teste faz o papel do gateway.
  const asaasToken = 'webhook-token-com-mais-de-trinta-e-dois-caracteres';
  // Uma API nova por tamanho de tela (o cadastro tem limite por hora) e o Asaas simulado dentro do próprio teste.
  for (const size of ['375', '1280']) {
    const asaasApi = await startApi(`ui-asaas-${size}`, { PAYMENT_PROVIDER: 'asaas', ASAAS_ENV: 'sandbox', ASAAS_API_KEY: 'plat-key', ASAAS_BASE_URL: `http://127.0.0.1:${PORTS.fakeAsaas}`, ASAAS_WEBHOOK_TOKEN: asaasToken, SECRETS_KEY: secretsKey });
    playwright(`C. Pagamento pelo Asaas simulado (tela ${size})`, { E2E_SPEC: 'asaas', E2E_ASAAS_WEBHOOK_TOKEN: asaasToken, E2E_ONLY_PROJECT: size }, `playwright-asaas-${size}.json`, asaasApi.logFile);
    kill(asaasApi.child); await sleep(800);
  }
  kill(preview);
  currentDb = DB_NAME;
}

// ---------- relatório ----------
function report() {
  const esc = (text) => String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const total = results.reduce((sum, r) => sum + r.ok + r.fail, 0), fails = results.reduce((sum, r) => sum + r.fail, 0);
  const rows = results.map((r) => `<tr class="${r.fail ? 'bad' : 'good'}"><td>${esc(r.group)}</td><td>${esc(r.name)}</td><td>${r.ok}</td><td>${r.fail}</td><td>${Math.round(r.ms / 1000)} s</td><td>${r.failures.map((f) => `<div>${esc(f).slice(0, 300)}</div>`).join('')}</td></tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório de teste do Dommos</title><style>body{font:14px Segoe UI,Arial;margin:24px;color:#1c1730}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd6f3;padding:6px 8px;vertical-align:top;text-align:left}th{background:#f4f1fb}.bad{background:#fef2f2}.good td:nth-child(4){color:#15803d}h1{color:#5b21b6}</style><h1>Relatório de teste do Dommos</h1><p>${new Date().toLocaleString('pt-BR')} · ${total} verificações · <strong>${fails} falhas</strong>. Relatório do navegador: <a href="playwright/index.html">playwright/index.html</a> · logs em <code>logs/</code>.</p><table><tr><th>Grupo</th><th>Suíte</th><th>Passou</th><th>Falhou</th><th>Tempo</th><th>Falhas</th></tr>${rows}</table></html>`;
  fs.writeFileSync(path.join(here, 'report', 'index.html'), html);
  fs.writeFileSync(path.join(here, 'report', 'resumo.json'), JSON.stringify({ quando: new Date().toISOString(), verificacoes: total, falhas: fails, suites: results }, null, 2));
  console.log(`\nResumo: ${total} verificações, ${fails} falhas. Relatório: ${path.join(here, 'report', 'index.html')}`);
  return fails;
}

try {
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  if (!process.env.E2E_SKIP_PREP) await ensureDb();
  for (const [group, file] of API_SUITES) {
    if (!wanted(file) || !fs.existsSync(path.join(here, 'suites', file))) continue;
    await runScript(group, file, file === 'pagamento-direto.mjs' ? { secondApi: { port: 3101, env: { PAYMENT_PROVIDER: 'mercadopago', MP_ACCESS_TOKEN: 'TEST-fake', MP_WEBHOOK_SECRET: 'segredo-de-teste', MP_API_URL: `http://127.0.0.1:${PORTS.fakeAsaas}`, PUBLIC_API_URL: 'http://localhost:3101' } } } : {});
  }
  if (wanted('desligado')) await runScript('D. Pedido aberto (recurso desligado)', 'pedido-aberto-desligado.mjs', { extraApi: { OPEN_REQUESTS_ENABLED: 'false' } });
  if (wanted('asaas') || wanted('webhooks')) {
    const asaasApi = { PAYMENT_PROVIDER: 'asaas', ASAAS_ENV: 'sandbox', ASAAS_API_KEY: 'plat-key', ASAAS_BASE_URL: `http://127.0.0.1:${PORTS.fakeAsaas}`, ASAAS_WEBHOOK_TOKEN: 'webhook-token-com-mais-de-trinta-e-dois-caracteres', SECRETS_KEY: secretsKey, FRONTEND_URL: 'http://127.0.0.1:5183' };
    const token = { ASAAS_WEBHOOK_TOKEN: 'webhook-token-com-mais-de-trinta-e-dois-caracteres' };
    if (wanted('asaas')) await runScript('C. Pagamento pelo Asaas (simulado)', 'pagamento-asaas.mjs', { args: [secretsKey, '@log'], extraApi: asaasApi, env: token });
    if (wanted('webhooks')) await runScript('C. Avisos do gateway fora de ordem (Asaas simulado)', 'webhooks-ordem.mjs', { extraApi: asaasApi, env: token });
  }
  if (wanted('ui') || !only) await runUi();
} catch (error) {
  console.error('\nERRO NO ORQUESTRADOR:', error.message);
  results.push({ group: 'Preparação', name: 'ambiente', ok: 0, fail: 1, failures: [error.message.slice(0, 600)], code: 1, ms: 0, kind: 'setup' });
}
const failures = report();
process.exitCode = failures ? 1 : 0;
