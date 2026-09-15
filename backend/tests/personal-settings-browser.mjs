// Real Edge + real API + temporary database account. No browser dependencies.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/config/prisma.js';
import { app } from '../src/app.js';
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(path.join(root, 'frontend'));
const artifacts = path.join(root, '.tmp', 'personal-settings-browser');
await fs.mkdir(artifacts, { recursive: true });
const browserProfile = await fs.mkdtemp(path.join(artifacts, 'edge-'));
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const apiUrl = `http://127.0.0.1:${server.address().port}`;
const vite = await createServer({ root: path.join(root, 'frontend'), define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') }, server: { host: '127.0.0.1', port: 5183, strictPort: true, proxy: { '/api': { target: apiUrl } } } });
await vite.listen();
const base = 'http://127.0.0.1:5183';
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${browserProfile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws, user;
const failures = [], runtimeErrors = [], networkFailures = [];
async function waitFor(fn, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { try { const result = await fn(); if (result) return result; } catch { /* wait */ } await sleep(100); }
  throw new Error(`Timeout: ${label}`);
}
try {
  const port = await waitFor(async () => (await fs.readFile(path.join(browserProfile, 'DevToolsActivePort'), 'utf8')).split('\n')[0], 'Edge startup');
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl); await once(ws, 'open');
  let sequence = 0; const waiting = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { const item = waiting.get(message.id); waiting.delete(message.id); if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 500) networkFailures.push({ status: message.params.response.status, path: new URL(message.params.response.url).pathname });
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const text = () => evaluate('document.body.innerText');
  const expectText = (value) => waitFor(async () => (await text()).includes(value), value);
  const click = async (label) => {
    const success = await evaluate(`(() => {const e=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()===${JSON.stringify(label)} && e.getClientRects().length && !e.disabled); if(!e)return false;e.click();return true;})()`);
    assert.ok(success, `Control found: ${label}`);
  };
  const fill = async (name, value) => {
    await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(`[name="${name}"]`)}); if(!e)throw Error('input missing');e.focus();e.select();})()`);
    await send('Input.insertText', { text: value });
  };
  const goto = async (route) => { await send('Page.navigate', { url: base + route }); await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'page ready'); };
  const check = async (name, fn) => { await fn(); console.log(`PASS ${name}`); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const suffix = crypto.randomUUID(); const email = `dommos-browser-${suffix}@example.invalid`; const password = crypto.randomBytes(20).toString('hex');
  const request = async (route, body) => (await fetch(apiUrl + '/api' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  await request('/auth/register', { email, password, first_name: 'DOMMOS', last_name: 'Navegador' });
  user = await prisma.user.findUnique({ where: { email } }); assert.ok(user);
  const session = await request('/auth/login', { email, password }); assert.ok(session.token);
  await goto('/login');
  await evaluate(`localStorage.setItem('token',${JSON.stringify(session.token)});localStorage.setItem('user',${JSON.stringify(JSON.stringify(session.user))});`);
  await check('load settings with real account', async () => { await goto('/configuracoes/pessoais'); await expectText('DOMMOS Navegador'); });
  await check('name save and persistence after refresh', async () => {
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/nome"]').click()`); await expectText('Confira suas informações');
    await fill('first_name', 'Nome Navegador'); await click('Salvar'); await expectText('Informações salvas com sucesso.');
    await send('Page.reload'); await expectText('Nome Navegador Navegador');
  });
  await check('dirty cancel preserves input and discard restores database value', async () => {
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/nome"]').click()`); await expectText('Confira suas informações');
    await fill('first_name', 'Não salvar'); await click('Voltar'); await expectText('Tem certeza de que quer sair?');
    await click('Continuar editando'); assert.equal(await evaluate('document.querySelector("[name=first_name]").value'), 'Não salvar');
    await click('Concluir'); await expectText('Tem certeza de que quer sair?'); await click('Sair sem salvar'); await waitFor(async () => (await evaluate('location.pathname')) === '/servicos', 'Concluir services');
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).firstName, 'Nome Navegador');
  });
  await check('browser back and settings sidebar respect dirty form', async () => {
    await goto('/configuracoes/pessoais'); await expectText('Nome legal');
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/preferencia"]').click()`); await expectText('Confira suas informações');
    await fill('preferred_name', 'Preferido'); await evaluate('history.back()'); await expectText('Tem certeza de que quer sair?'); await click('Continuar editando');
    await click('Privacidade'); await expectText('Tem certeza de que quer sair?'); await click('Continuar editando');
    await click('Salvar'); await expectText('Preferido');
  });
  await check('refresh raises beforeunload only for pending changes', async () => {
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/nome"]').click()`); await expectText('Confira suas informações'); await fill('first_name', 'Rascunho');
    let seen = false;
    const handler = (event) => { const m = JSON.parse(event.data); if (m.method === 'Page.javascriptDialogOpening') { seen = m.params.type === 'beforeunload'; send('Page.handleJavaScriptDialog', { accept: false }); } };
    ws.addEventListener('message', handler);
    await send('Page.reload'); await waitFor(() => seen, 'beforeunload dialog'); ws.removeEventListener('message', handler);
    assert.equal(await evaluate('document.querySelector("[name=first_name]").value'), 'Rascunho');
    await click('Voltar'); await expectText('Tem certeza de que quer sair?'); await click('Sair sem salvar'); await expectText('Nome legal');
  });
  await check('mobile layout fits viewport and navigation works', async () => {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await expectText('Informações pessoais'); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/residencial"]').click()`); await expectText('Confira suas informações');
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then((r) => fs.writeFile(path.join(artifacts, 'mobile-address.png'), Buffer.from(r.data, 'base64')));
    await click('Voltar'); await expectText('Nome legal');
  });
  await check('profile, public pages, professional flow and logout', async () => {
    for (const [route, content] of [['/perfil', 'Sobre mim'], ['/perfil/avaliacoes', 'Você ainda não possui avaliações.'], ['/perfil/resumo-profissional', 'Você ainda não possui um perfil profissional.'], ['/perfil/profissional', 'Criar perfil profissional']]) { await goto(route); await expectText(content); }
    for (const route of ['/', '/servicos', '/buscar']) { await goto(route); await waitFor(async () => (await text()).length > 100, route); }
    await goto('/configuracoes/pessoais'); await expectText('Nome legal');
    await evaluate(`[...document.querySelectorAll('button[aria-label="Abrir menu"]')].find(e=>e.getClientRects().length).click()`); await click('Sair');
    await waitFor(async () => (await evaluate('location.pathname')) === '/login', 'logout');
    assert.equal(await evaluate('localStorage.getItem("token")'), null);
  });
  assert.deepEqual(runtimeErrors, []); assert.deepEqual(networkFailures, []);
  console.log('PASS browser console and Network: no runtime exceptions or HTTP 5xx');
} catch (err) {
  failures.push(err.message); console.error('FAIL', err.message);
} finally {
  ws?.close(); browser.kill(); await vite.close(); server.close();
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
  await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ failures, runtimeErrors, networkFailures }, null, 2));
  // The isolated browser profile remains in .tmp for local inspection; it contains test-only session data.
}
if (failures.length) process.exitCode = 1;
