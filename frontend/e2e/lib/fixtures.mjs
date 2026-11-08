import zlib from 'node:zlib';

export const API = process.env.E2E_API ?? `http://localhost:${process.env.E2E_API_PORT ?? 3100}/api`;
export const PW = 'senha-forte-1';
export const stamp = Date.now();

export const call = async (method, path, body, token, headers = {}) => {
  const response = await fetch(API + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await response.json(); } catch { /* sem corpo */ }
  return { s: response.status, d: data };
};

function png() {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const table = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = ~0; for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  return Buffer.concat([sig, chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 120, 60, 200]))), chunk('IEND', Buffer.alloc(0))]);
}
export const upload = async (token, purpose = 'service') => { const form = new FormData(); form.set('purpose', purpose); form.set('file', new Blob([png()], { type: 'image/png' }), 'a.png'); const r = await fetch(API + '/uploads', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: form }); return (await r.json()).url; };

export async function register(name) {
  const email = `teste-${name}${stamp}@teste.invalid`.toLowerCase();
  await call('POST', '/auth/register', { first_name: 'Teste', last_name: name, email, password: PW });
  const login = await call('POST', '/auth/login', { email, password: PW });
  return { email, token: login.d.token, user: login.d.user, uuid: login.d.user.uuid };
}

export const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const nextWeekday = (weekday, minDays) => { const d = new Date(); d.setDate(d.getDate() + minDays); while (d.getDay() !== weekday) d.setDate(d.getDate() + 1); return key(d); };

export async function publishListing(owner, pricing = { pricing_model: 'fixed', price: 150, travel_fee: 20 }, title = 'Instalação de chuveiro elétrico') {
  const cats = (await call('GET', '/categories')).d;
  const items = (await call('GET', '/service-catalog')).d;
  const item = items.find((i) => i.category.id === cats[0].id);
  const L = (await call('POST', '/pro/listings', null, owner.token)).d.uuid;
  const imgs = [await upload(owner.token), await upload(owner.token), await upload(owner.token)];
  const week = [1, 2, 3, 4, 5].map((day) => ({ day, from: '08:00', to: '18:00' }));
  const patch = (b) => call('PATCH', '/pro/listings/' + L, b, owner.token);
  await patch({ category_id: cats[0].id, catalog_item_id: item.id, service_modes: ['client_place', 'remote'], city: 'Curitiba', state: 'PR', radius_km: 25 });
  await patch({ title, description: 'Instalo chuveiros elétricos com garantia de 90 dias, deixo tudo limpo e funcionando.', image_urls: imgs, included: ['Mão de obra'], excluded: [], ...pricing, availability: { weekdays: week, lead_time_hours: 24 }, cancellation_policy: 'moderate' });
  await call('PUT', '/pro/verification', { legal_name: 'Maria da Silva', document_type: 'cpf', document: '529.982.247-25' }, owner.token);
  const published = await call('POST', `/pro/listings/${L}/publish`, null, owner.token);
  return { uuid: L, status: published.s };
}

// Endereço de teste para pedidos feitos na casa do cliente (o servidor exige o endereço nesse modo).
export const ADDRESS = { postal_code: '80010-000', street: 'Rua das Flores', number: '123', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' };

/** Cria uma conta de administrador de teste (cada suíte cria a sua: nenhuma depende de dados de outra). */
export async function makeAdmin(name = 'AdminTeste') {
  const { sql } = await import('./env.mjs');
  const account = await register(name);
  sql(`INSERT IGNORE INTO roles (name) VALUES ('admin')`);
  sql(`INSERT IGNORE INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u, roles r WHERE u.email='${account.email}' AND r.name='admin'`);
  const login = await call('POST', '/auth/login', { email: account.email, password: PW });
  return { ...account, token: login.d.token, user: login.d.user };
}
