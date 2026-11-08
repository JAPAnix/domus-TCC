import test from 'node:test';
import assert from 'node:assert/strict';

// Teste de fumaça do painel do administrador contra uma API já rodando (nunca contra produção com dados reais sem querer).
// Uso: $env:ADMIN_SMOKE_API='http://localhost:3000/api'; $env:ADMIN_EMAIL='...'; $env:ADMIN_PASSWORD='...'; npm test
// Sem essas variáveis o teste é pulado.
const API = process.env.ADMIN_SMOKE_API;
const skip = !API || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD;

const call = async (method, path, body, token) => {
  const response = await fetch(API + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await response.json(); } catch { /* sem corpo */ }
  return { status: response.status, data };
};

const ROUTES = ['/admin/summary', '/admin/payments', '/admin/disputes', '/admin/alerts', '/admin/transactions', '/admin/audit', '/admin/webhook-events', '/admin/help-assistant', '/admin/moderation'];

test('admin: toda rota exige login (401)', { skip }, async () => {
  for (const route of ROUTES) assert.equal((await call('GET', route)).status, 401, route);
});

test('admin: toda rota carrega sem erro com o administrador (200)', { skip }, async () => {
  const login = await call('POST', '/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  assert.equal(login.status, 200, 'login do administrador');
  for (const route of ROUTES) {
    const result = await call('GET', route, null, login.data.token);
    assert.equal(result.status, 200, `${route}: ${result.data?.message ?? ''}`);
  }
});

test('admin: usuário comum recebe 403 em toda rota', { skip }, async () => {
  const email = `smoke${Date.now()}@teste.invalid`;
  await call('POST', '/auth/register', { first_name: 'Teste', last_name: 'Fumaca', email, password: 'senha-forte-1' });
  const login = await call('POST', '/auth/login', { email, password: 'senha-forte-1' });
  assert.equal(login.status, 200);
  for (const route of ROUTES) assert.equal((await call('GET', route, null, login.data.token)).status, 403, route);
  assert.equal((await call('POST', '/admin/moderation/1/resolve', { action: 'dismiss', note: 'tentativa' }, login.data.token)).status, 403);
});
