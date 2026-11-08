import { execFileSync } from 'node:child_process';

// Uso: API=http://localhost:3101/api DB=dommos_old node admin-routes.mjs
const API = process.env.API ?? 'http://localhost:3100/api';
const DB = process.env.DB ?? (process.env.E2E_DB ?? 'dommos_teste');
const PW = 'senha-forte-1';
const sql = (q) => execFileSync((process.env.E2E_MYSQL ?? 'C:/xampp/mysql/bin/mysql.exe'), ['-h127.0.0.1', `-P${process.env.E2E_DB_PORT ?? 3307}`, '--default-character-set=utf8mb4', '-uroot', DB, '-N', '-e', q]).toString().trim();
const call = async (method, path, body, token) => {
  const response = await fetch(API + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await response.json(); } catch { /* sem corpo */ }
  return { s: response.status, d: data };
};
const stamp = Date.now();
const mk = async (name) => {
  const email = `${name}${stamp}@teste.invalid`;
  await call('POST', '/auth/register', { first_name: 'Teste', last_name: name, email, password: PW });
  const login = await call('POST', '/auth/login', { email, password: PW });
  return { email, token: login.d?.token };
};
const admin = await mk('AdminSmoke'), user = await mk('UserSmoke');
sql(`INSERT IGNORE INTO roles (name) VALUES ('admin')`);
sql(`INSERT IGNORE INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.email='${admin.email}' AND r.name='admin'`);
const login = await call('POST', '/auth/login', { email: admin.email, password: PW });
admin.token = login.d.token;

const routes = ['/admin/summary', '/admin/payments', '/admin/disputes', '/admin/alerts', '/admin/transactions', '/admin/audit', '/admin/webhook-events', '/admin/help-assistant', '/admin/moderation'];
const rows = [];
for (const route of routes) {
  const anon = await call('GET', route);
  const common = await call('GET', route, null, user.token);
  const adm = await call('GET', route, null, admin.token);
  rows.push({ route, anon: anon.s, comum: common.s, admin: adm.s, erro: adm.s >= 400 ? adm.d?.message : '' });
}
console.table(rows);
const bad = rows.filter((row) => row.admin !== 200 || row.anon !== 401 || row.comum !== 403);
console.log(JSON.stringify({ rotas: rows.length, comProblema: bad.map((row) => row.route) }));
process.exitCode = bad.length ? 1 : 0;
