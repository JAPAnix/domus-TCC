// Real Edge + real API + temporary database account. No browser dependencies.
import { spawn } from 'node:child_process';
import net from 'node:net';
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
const codes = [];
const smtp = net.createServer((socket) => {
  socket.write('220 localhost SMTP test\r\n');
  let buffer = '', message = '', inData = false;
  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
      if (inData) {
        if (line === '.') { const code = message.match(/\b\d{6}\b/)?.[0]; if (code) codes.push(code); inData = false; message = ''; socket.write('250 accepted\r\n'); }
        else message += line + '\n';
      } else if (/^(EHLO|HELO)/.test(line)) socket.write('250 localhost\r\n');
      else if (line === 'DATA') { inData = true; socket.write('354 data\r\n'); }
      else if (line === 'QUIT') socket.end('221 bye\r\n');
      else socket.write('250 ok\r\n');
    }
  });
}).listen(0, '127.0.0.1');
await once(smtp, 'listening');
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_SECURE: 'false', SMTP_USER: '', SMTP_PASS: '', EMAIL_FROM: 'DOMMOS <test@example.invalid>', SMS_PROVIDER: 'console', NODE_ENV: 'development' });
const originalInfo = console.info;
console.info = (...args) => { const code = String(args[0]).match(/Código: (\d{6})/)?.[1]; if (code) codes.push(code); else originalInfo(...args); };
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
  const evaluate = async (expression) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const text = () => evaluate('document.body.innerText');
  const expectText = (value) => waitFor(async () => (await text()).includes(value), value);
  const click = async (label) => {
    const success = await evaluate(`(() => {const e=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()===${JSON.stringify(label)} && e.getClientRects().length && !e.disabled); if(!e)return false;e.click();return true;})()`);
    assert.ok(success, `Control found: ${label}`);
  };
  const fill = async (name, value) => {
    const dateInput = await evaluate(`document.querySelector('[name="${name}"]')?.type === 'date'`);
    if (dateInput) {
      await evaluate(`(() => { const e = document.querySelector('[name="${name}"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await sleep(100); return;
    }
    await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(`[name="${name}"]`)}); if(!e)throw Error('input missing');e.focus();e.select();})()`);
    await send('Input.insertText', { text: value });
  };
  const goto = async (route) => { await send('Page.navigate', { url: base + route }); await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'page ready'); };
  const reload = async () => {
    const navigated = new Promise((resolve) => {
      const handler = (event) => {
        const message = JSON.parse(event.data);
        if (message.method === 'Page.frameNavigated' && !message.params.frame.parentId) {
          ws.removeEventListener('message', handler); resolve();
        }
      };
      ws.addEventListener('message', handler);
    });
    await send('Page.reload'); await navigated;
    await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'reload complete');
  };
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
    await reload(); await expectText('Nome Navegador Navegador');
  });
  await check('dirty cancel preserves input and discard restores database value', async () => {
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/nome"]').click()`); await expectText('Confira suas informações');
    await fill('first_name', 'Não salvar'); await click('Voltar'); await expectText('Tem certeza de que quer sair?');
    await click('Continuar editando'); assert.equal(await evaluate('document.querySelector("[name=first_name]").value'), 'Não salvar');
    await click('Concluir'); await expectText('Tem certeza de que quer sair?'); await click('Sair sem salvar'); await waitFor(async () => (await evaluate('location.pathname')) === '/configuracoes/pessoais', 'Concluir personal settings');
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
  await check('birth date, home, postal and emergency forms persist', async () => {
    async function edit(section, fields) {
      await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/${section}"]').click()`);
      await expectText('Confira suas informações');
      for (const [key, value] of Object.entries(fields)) await fill(key, value);
      await click('Salvar'); await expectText('Informações salvas com sucesso.');
    }
    await edit('nascimento', { birth_date: '2000-02-29' });
    const address = { zip_code: '01001-000', street: 'Rua Teste', number: '12', complement: 'Apto 1', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' };
    await edit('residencial', address);
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/postal"]').click()`);
    await expectText('Usar o mesmo endereço residencial');
    await evaluate(`document.querySelector('[name="same_as_home"]').click()`);
    for (const [key, value] of Object.entries({ ...address, number: '99' })) await fill(key, value);
    await click('Salvar'); await expectText('Informações salvas com sucesso.');
    let saved = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(saved.zipCode, '01001000'); assert.equal(saved.postalAddress.number, '99');
    assert.equal(saved.birthDate.toISOString().slice(0, 10), '2000-02-29');
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/postal"]').click()`);
    await expectText('Usar o mesmo endereço residencial');
    await evaluate(`document.querySelector('[name="same_as_home"]').click()`);
    await click('Salvar'); await expectText('Mesmo endereço residencial');
    await edit('emergencia', { name: 'Contato Navegador', phone: '+5511999998888' });
    await reload(); await expectText('Contato Navegador');
    saved = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(saved.postalSameAsHome, true); assert.equal(saved.postalAddress, null);
    assert.equal(saved.emergencyContact.phone, '+5511999998888');
  });
  await check('email and SMS forms reject wrong codes and confirm persisted contacts', async () => {
    for (const [section, target] of [['email', `browser-new-${suffix}@example.invalid`], ['phone', '119' + String(crypto.randomInt(10000000, 99999999))]]) {
      await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/${section}"]').click()`);
      await expectText('Confirme o novo contato'); await fill('target', target); await click('Enviar código');
      await expectText('Código de confirmação');
      const original = await prisma.user.findUnique({ where: { id: user.id } });
      assert.notEqual(section === 'email' ? original.email : original.phoneNumber, section === 'email' ? target : '+55' + target);
      const code = codes.at(-1); assert.match(code, /^\d{6}$/);
      await fill('code', code === '000000' ? '111111' : '000000'); await click('Confirmar');
      await expectText('O código informado é inválido.');
      await fill('code', code); await click('Confirmar'); await expectText('Contato confirmado e atualizado.');
      const saved = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(section === 'email' ? saved.email : saved.phoneNumber, section === 'email' ? target : '+55' + target);
      assert.equal(section === 'email' ? saved.isEmailVerified : saved.isPhoneVerified, true);
      await reload(); await expectText('Nome legal');
    }
  });
  await check('desktop and tablet fit the viewport', async () => {
    for (const [label, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await fs.writeFile(path.join(artifacts, `${label}-personal.png`), Buffer.from(shot.data, 'base64'));
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  });
  await check('logout preserves session until dirty changes are discarded', async () => {
    await goto('/configuracoes/pessoais'); await expectText('Nome legal');
    await evaluate(`document.querySelector('a[href="/configuracoes/pessoais/nome"]').click()`);
    await expectText('Confira suas informações'); await fill('first_name', 'Rascunho logout');
    await click('Sair'); await expectText('Tem certeza de que quer sair?');
    assert.ok(await evaluate('localStorage.getItem("token")'));
    await click('Continuar editando');
    assert.equal(await evaluate('document.querySelector("[name=first_name]").value'), 'Rascunho logout');
    await click('Sair'); await expectText('Tem certeza de que quer sair?'); await click('Sair sem salvar');
    await waitFor(async () => (await evaluate('location.pathname')) === '/login', 'confirmed logout');
    assert.equal(await evaluate('localStorage.getItem("token")'), null);
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).firstName, 'Nome Navegador');
    await evaluate(`localStorage.setItem('token',${JSON.stringify(session.token)});localStorage.setItem('user',${JSON.stringify(JSON.stringify(session.user))});`);
    await goto('/bem-vindo'); await expectText('Nome legal');
    assert.equal(await evaluate('location.pathname'), '/configuracoes/pessoais');
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
    for (const [route, content] of [['/perfil', 'Sobre mim'], ['/perfil/avaliacoes', 'Você ainda não possui avaliações.'], ['/perfil/resumo-profissional', 'Você ainda não possui um perfil profissional.'], ['/perfil/profissional', 'Crie seu perfil profissional']]) { await goto(route); await expectText(content); }
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
  console.info = originalInfo; smtp.close(); ws?.close(); browser.kill(); await vite.close(); server.close();
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
  await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ failures, runtimeErrors, networkFailures }, null, 2));
  // The isolated browser profile remains in .tmp for local inspection; it contains test-only session data.
}
if (failures.length) process.exitCode = 1;
