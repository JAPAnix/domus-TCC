// Frontend-only test: isolated API fixture, no database or external provider.
import { spawn } from 'node:child_process';
import { createServer as httpServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(path.join(root, 'frontend'));
const artifacts = path.join(root, '.tmp', 'identity-verification');
await fs.mkdir(artifacts, { recursive: true });
const profile = await fs.mkdtemp(path.join(artifacts, 'edge-'));
const fixture = { uuid: 'identity-ui-test', firstName: 'Pessoa', lastName: 'Teste', preferredName: '', birthDate: '2000-01-02', email: 'test@example.invalid', roles: ['client'], zipCode: '01001000', street: 'Rua de teste', number: '10', complement: '', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', postalSameAsHome: true, pending: {} };
const writes = [], errors = [];
const api = httpServer((req, res) => {
  if (req.method !== 'GET') writes.push(req.method + ' ' + req.url);
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/auth/me') res.end(JSON.stringify(fixture));
  else { res.statusCode = 404; res.end('{}'); }
}).listen(0, '127.0.0.1');
await once(api, 'listening');
const vite = await createServer({ root: path.join(root, 'frontend'), define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') }, server: { host: '127.0.0.1', port: 5184, strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${api.address().port}` } } } });
await vite.listen();
const browser = spawn(process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function wait(fn, label) { for (let i = 0; i < 150; i++) { try { if (await fn()) return; } catch { /* page transitioning */ } await sleep(100); } throw new Error(`Timeout: ${label}`); }
let ws;
try {
  let port;
  await wait(async () => { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return port; }, 'Edge');
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl); await once(ws, 'open');
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { const task = pending.get(message.id); pending.delete(message.id); if (message.error) task?.reject(new Error(message.error.message)); else task?.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push('Console error');
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    const cep = request.url.match(/\/ws\/(\d{8})\//)?.[1];
    if (cep === '88888888') {
      send('Fetch.fulfillRequest', { requestId, responseCode: 503, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from('{}').toString('base64') });
      return;
    }
    if (cep === '77777777') {
      send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from('{}').toString('base64') });
      return;
    }
    if (cep === '66666666' || cep === '55555555') {
      setTimeout(() => send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify({ logradouro: 'Resposta atrasada', localidade: 'Cidade atrasada', uf: 'RJ' })).toString('base64') }).catch(() => {}), cep === '66666666' ? 1000 : 9000);
      return;
    }
    const body = cep === '99999999' ? { erro: true } : cep === '12345000' ? { localidade: 'Cidade parcial', uf: 'SP' } : { logradouro: 'Rua consultada', bairro: 'Bairro consultado', localidade: 'Cidade consultada', uf: 'SP' };
    send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://viacep.com.br/*' }] });
  const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  const expectText = (text) => wait(() => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), text);
  const click = async (label) => { await wait(() => evaluate(`(() => {const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(label)} && e.getClientRects().length);if(!e)return false;e.click();return true;})()`), label); };
  const fill = async (name, text) => { await evaluate(`document.querySelector('[name="${name}"]').focus();document.querySelector('[name="${name}"]').select()`); await send('Input.insertText', { text }); };
  const settings = '/configuracoes/pessoais'; const identity = settings + '/verificacao-identidade';
  const goto = (route) => send('Page.navigate', { url: 'http://127.0.0.1:5184' + route });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await goto('/login'); await expectText('Entrar');
  await evaluate(`localStorage.setItem('token','test-only');localStorage.setItem('user',${JSON.stringify(JSON.stringify(fixture))});`);
  await goto('/configuracoes'); await expectText('Verificação de identidade'); await expectText('Identidade não verificada');
  await expectText('Email não confirmado'); await expectText('Telefone não confirmado');
  await click('Começar'); await expectText('Confirme as informações da sua conta');
  assert.equal(await evaluate('location.pathname'), identity);
  assert.equal(await evaluate('document.querySelector("[name=first_name]").value'), fixture.firstName);
  assert.equal(await evaluate('document.querySelector("[name=zip_code]").value'), '01001-000');
  assert.equal(await evaluate('document.querySelector("[name=cpf]").value'), '');
  assert.equal(await evaluate('document.querySelector("[name=country]").value'), '');
  await fill('zip_code', '12345678'); await expectText('Consulta concluída.');
  assert.equal(await evaluate('document.querySelector("[name=street]").value'), 'Rua consultada');
  assert.equal(await evaluate('document.querySelector("[name=city]").value'), 'Cidade consultada');
  assert.equal(await evaluate('document.querySelector("[name=country]").value'), 'BR');
  assert.equal(await evaluate('document.querySelector("[name=number]").value'), '10');
  await fill('zip_code', '99999999'); await expectText('CEP não encontrado.');
  await fill('street', 'Endereço manual');
  await fill('zip_code', '12345000'); await expectText('Consulta concluída.');
  assert.equal(await evaluate('document.querySelector("[name=street]").value'), 'Endereço manual');
  assert.equal(await evaluate('document.querySelector("[name=city]").value'), 'Cidade parcial');
  console.log('PASS CEP autofill, unknown CEP, partial address and manual fallback (mock ViaCEP)');
  await fill('zip_code', '88888888'); await expectText('Não foi possível consultar o CEP.');
  await fill('street', 'Preenchido manualmente');
  await fill('zip_code', '77777777'); await expectText('Não foi possível consultar o CEP.');
  assert.equal(await evaluate('document.querySelector("[name=street]").value'), 'Preenchido manualmente');
  await fill('zip_code', '66666666'); await fill('street', 'Edição durante consulta'); await expectText('Consulta concluída.');
  assert.equal(await evaluate('document.querySelector("[name=street]").value'), 'Edição durante consulta');
  await fill('zip_code', '66666666'); await fill('zip_code', '12345678'); await expectText('Consulta concluída.'); await sleep(1200);
  assert.equal(await evaluate('document.querySelector("[name=city]").value'), 'Cidade consultada');
  await fill('zip_code', '55555555'); await expectText('Não foi possível consultar o CEP.');
  await fill('zip_code', '123'); assert.equal(await evaluate('document.querySelector("[name=city]").value'), 'Cidade consultada');
  await fill('zip_code', '12345678'); await expectText('Consulta concluída.');
  console.log('PASS CEP HTTP failure, malformed response, timeout, stale response and concurrent manual edit');
  await click('Voltar'); await expectText('Tem certeza de que quer sair?');
  await click('Continuar agora'); await expectText('Confirme as informações da sua conta');
  console.log('PASS untouched form always confirms exit; saved data prefilled');
  await fill('preferred_name', 'Rascunho'); await click('Voltar'); await expectText('Tem certeza de que quer sair?'); await click('Continuar agora'); await expectText('Confirme as informações da sua conta');
  assert.equal(await evaluate('document.querySelector("[name=preferred_name]").value'), 'Rascunho');
  await evaluate('history.back()'); await expectText('Tem certeza de que quer sair?'); await click('Continuar agora'); await expectText('Confirme as informações da sua conta');
  assert.equal(await evaluate('document.querySelector("[name=preferred_name]").value'), 'Rascunho');
  console.log('PASS back button and browser history preserve draft after continuing');
  await click('Continuar'); await expectText('Preencha este campo.');
  assert.equal(await evaluate('document.activeElement.name'), 'cpf');
  await fill('cpf', '12345678901');
  await click('Continuar'); await expectText('CPF inválido.');
  assert.equal(await evaluate('document.activeElement.name'), 'cpf');
  await fill('cpf', '11111111111'); await click('Continuar'); await expectText('CPF inválido.');
  await fill('cpf', '52998224725');
  await evaluate(`const e=document.querySelector('[name=country]');e.value='BR';e.dispatchEvent(new Event('change',{bubbles:true}));`);
  await click('Continuar'); await expectText('Nenhum dado foi enviado ou salvo');
  assert.deepEqual(writes, []);
  await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then((r) => fs.writeFile(path.join(artifacts, 'desktop.png'), Buffer.from(r.data, 'base64')));
  console.log('PASS validation and Continue without writes or verified status');
  await click('Voltar'); await expectText('Tem certeza de que quer sair?'); await click('Sair'); await expectText('Informações pessoais');
  assert.equal(await evaluate('location.pathname'), settings); await expectText('Identidade não verificada');
  assert.equal(await evaluate('localStorage.getItem("token")'), 'test-only');
  await click('Começar'); await expectText('Confirme as informações da sua conta');
  assert.equal(await evaluate('document.querySelector("[name=preferred_name]").value'), '');
  await fill('preferred_name', 'Não persistir'); await send('Page.reload'); await expectText('Confirme as informações da sua conta');
  await wait(() => evaluate('document.querySelector("[name=preferred_name]")?.value === ""'), 'refresh discards draft');
  console.log('PASS exit returns to personal settings, keeps session, discards draft; refresh works');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then((r) => fs.writeFile(path.join(artifacts, 'mobile.png'), Buffer.from(r.data, 'base64')));
  await click('Voltar'); await expectText('Tem certeza de que quer sair?');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await click('Sair'); await expectText('Verificação de identidade');
  fixture.isEmailVerified = true; fixture.isPhoneVerified = true;
  await goto(settings); await expectText('Email confirmado'); await expectText('Telefone confirmado'); await expectText('Identidade não verificada');
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log('PASS mobile, console, and zero mutation requests');
} finally { ws?.close(); browser.kill(); await vite.close(); api.close(); }
