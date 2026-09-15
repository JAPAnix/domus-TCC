import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { personalSchemas, normalizePhone } from '../src/validators/personalSettingsValidator.js';
import { sendVerificationCode } from '../src/services/smsService.js';

test('validation rejects invalid dates, contacts, addresses, and foreign fields', () => {
  assert.equal(normalizePhone('(11) 99999-8888'), '+5511999998888');
  assert.equal(normalizePhone('+351 912345678'), '+351912345678');
  for (const value of ['123', '+5500000000000', 'letters']) assert.throws(() => normalizePhone(value));
  for (const birth_date of ['2025-02-30', '2999-01-01', '2023-02-29', '0000-01-01']) assert.equal(personalSchemas.nascimento.safeParse({ birth_date }).success, false);
  assert.equal(personalSchemas.nascimento.safeParse({ birth_date: '2000-02-29' }).success, true);
  assert.equal(personalSchemas.nome.safeParse({ first_name: ' ', last_name: 'Test' }).success, false);
  assert.equal(personalSchemas.nome.safeParse({ first_name: 'Test', last_name: 'Test', userId: '1' }).success, false);
  assert.equal(personalSchemas.postal.safeParse({ same_as_home: true, address: {} }).success, false);
});

test('SMS console is forbidden in production', async () => {
  const old = { env: process.env.NODE_ENV, provider: process.env.SMS_PROVIDER };
  process.env.NODE_ENV = 'production'; process.env.SMS_PROVIDER = 'console';
  try { await assert.rejects(sendVerificationCode('+5511999998888', '123456'), { status: 503 }); }
  finally { if (old.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old.env; if (old.provider === undefined) delete process.env.SMS_PROVIDER; else process.env.SMS_PROVIDER = old.provider; }
});

test('authenticated API persists data and verifies contacts transactionally', { skip: !process.env.RUN_DB_TESTS, timeout: 120000 }, async (t) => {
  const { prisma } = await import('../src/config/prisma.js');
  const { app } = await import('../src/app.js');
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
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = crypto.randomUUID();
  const email = `dommos-test-${suffix}@example.invalid`;
  const secondEmail = `dommos-other-${suffix}@example.invalid`;
  const password = crypto.randomBytes(20).toString('hex');
  let user, other;
  async function request(path, method = 'GET', body, token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  try {
    assert.equal((await request('/auth/register', 'POST', { first_name: 'DOMMOS', last_name: 'Teste', email, password })).status, 201);
    assert.equal((await request('/auth/register', 'POST', { first_name: 'DOMMOS', last_name: 'Outro', email: secondEmail, password })).status, 201);
    user = await prisma.user.findUnique({ where: { email } }); other = await prisma.user.findUnique({ where: { email: secondEmail } });
    const login = await request('/auth/login', 'POST', { email, password }); assert.equal(login.status, 200);
    const token = login.data.token;
    const api = (path, method, body) => request(path, method, body, token);
    assert.equal((await request('/users/me/personal')).status, 401);
    assert.equal((await api('/users/me/personal/nome', 'PATCH', { first_name: 'Nome', last_name: 'Persistido' })).status, 200);
    assert.equal((await api('/auth/me')).data.firstName, 'Nome');
    assert.equal((await api('/users/me/personal/preferencia', 'PATCH', { preferred_name: ' Preferido ' })).data.preferredName, 'Preferido');
    assert.equal((await api('/users/me/personal/nascimento', 'PATCH', { birth_date: '2000-02-29' })).data.birthDate, '2000-02-29');
    assert.equal((await api('/users/me/personal/nascimento', 'PATCH', { birth_date: '2999-01-01' })).status, 422);
    const address = { zip_code: '01001-000', street: 'Rua de teste', number: '1', complement: '', neighborhood: 'Centro', city: 'São Paulo', state: 'sp' };
    assert.equal((await api('/users/me/personal/residencial', 'PATCH', address)).data.zipCode, '01001000');
    assert.equal((await api('/users/me/personal/postal', 'PATCH', { same_as_home: false, address })).data.postalAddress.state, 'SP');
    assert.equal((await api('/users/me/personal/postal', 'PATCH', { same_as_home: true })).data.postalAddress, null);
    assert.equal((await api('/users/me/personal/emergencia', 'PATCH', { name: 'Contato teste', relationship: 'Amigo', phone: '+55 11 99999-8888' })).data.emergencyContact.phone, '+5511999998888');
    assert.equal((await api('/users/me/personal/residencial', 'PATCH', { ...address, zip_code: '000' })).status, 422);
    assert.equal((await api(`/users/${login.data.user.uuid}`, 'PATCH', { phone_number: '11999998888' })).status, 400);
    const otherLogin = await request('/auth/login', 'POST', { email: secondEmail, password });
    assert.equal((await api(`/users/${otherLogin.data.user.uuid}`, 'PATCH', { first_name: 'Intruso' })).status, 403);
    assert.equal((await api('/users/me/contact/email/solicitar', 'POST', { target: secondEmail })).status, 409);
    const newEmail = `dommos-new-${suffix}@example.invalid`;
    assert.equal((await api('/users/me/contact/email/solicitar', 'POST', { target: newEmail })).status, 201);
    const code = codes.at(-1); assert.match(code, /^\d{6}$/);
    assert.equal((await api('/auth/me')).data.email, email);
    assert.equal((await api('/users/me/contact/email/confirmar', 'POST', { code: code === '000000' ? '111111' : '000000' })).status, 400);
    const record = await prisma.contactVerification.findFirst({ where: { userId: user.id, type: 'email', usedAt: null } });
    assert.equal(record.attempts, 1); assert.notEqual(record.codeHash, code);
    assert.equal((await api('/users/me/contact/email/solicitar', 'POST', { target: newEmail })).status, 429);
    await prisma.contactVerification.update({ where: { id: record.id }, data: { expiresAt: new Date(0) } });
    assert.equal((await api('/users/me/contact/email/confirmar', 'POST', { code })).status, 400);
    await prisma.contactVerification.update({ where: { id: record.id }, data: { createdAt: new Date(Date.now() - 61000) } });
    assert.equal((await api('/users/me/contact/email/solicitar', 'POST', { target: newEmail })).status, 201);
    const freshCode = codes.at(-1);
    const confirmed = await api('/users/me/contact/email/confirmar', 'POST', { code: freshCode }); assert.equal(confirmed.status, 200); assert.equal(confirmed.data.email, newEmail);
    assert.equal((await api('/users/me/contact/email/confirmar', 'POST', { code: freshCode })).status, 400);
    assert.equal((await request('/auth/login', 'POST', { email: newEmail, password })).status, 200);
    assert.equal((await request('/auth/login', 'POST', { email, password })).status, 401);
    assert.equal((await api('/users/me/contact/phone/solicitar', 'POST', { target: '123' })).status, 422);
    const phone = '+55119' + String(crypto.randomInt(10000000, 99999999));
    const sent = await api('/users/me/contact/phone/solicitar', 'POST', { target: phone }); assert.equal(sent.status, 201); assert.equal(sent.data.delivery, 'development-console');
    const phoneCode = codes.at(-1);
    assert.equal((await api('/auth/me')).data.phoneNumber, null);
    assert.equal((await api('/users/me/contact/phone/confirmar', 'POST', { code: phoneCode === '000000' ? '111111' : '000000' })).status, 400);
    const phoneRecord = await prisma.contactVerification.findFirst({ where: { userId: user.id, type: 'phone', usedAt: null } });
    for (let i = 0; i < 4; i++) assert.equal((await api('/users/me/contact/phone/confirmar', 'POST', { code: phoneCode === '000000' ? '111111' : '000000' })).status, 400);
    assert.equal((await api('/users/me/contact/phone/confirmar', 'POST', { code: phoneCode })).status, 429);
    await prisma.contactVerification.update({ where: { id: phoneRecord.id }, data: { createdAt: new Date(Date.now() - 61000) } });
    assert.equal((await api('/users/me/contact/phone/solicitar', 'POST', { target: phone })).status, 201);
    const resentPhoneCode = codes.at(-1);
    const concurrent = await Promise.all([api('/users/me/contact/phone/confirmar', 'POST', { code: resentPhoneCode }), api('/users/me/contact/phone/confirmar', 'POST', { code: resentPhoneCode })]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 400]);
    const final = (await api('/auth/me')).data; assert.equal(final.phoneNumber, phone); assert.equal(final.isPhoneVerified, true);
    assert.equal((await request('/users/me/contact/phone/solicitar', 'POST', { target: phone }, otherLogin.data.token)).status, 409);
    const pendingEmail = `dommos-pending-${suffix}@example.invalid`;
    await prisma.contactVerification.updateMany({ where: { userId: user.id, type: 'email' }, data: { createdAt: new Date(Date.now() - 61000) } });
    assert.equal((await api('/users/me/contact/email/solicitar', 'POST', { target: pendingEmail })).status, 201);
    const cancelledCode = codes.at(-1);
    assert.equal((await api('/users/me/contact/email/cancelar', 'POST', {})).status, 200);
    assert.equal((await api('/users/me/contact/email/confirmar', 'POST', { code: cancelledCode })).status, 400);
    assert.equal((await api('/auth/me')).data.email, newEmail);
    await prisma.contactVerification.updateMany({ where: { userId: user.id, type: 'email' }, data: { createdAt: new Date(Date.now() - 61000) } });
    assert.equal((await api('/users/me/contact/email/solicitar', 'POST', { target: pendingEmail })).status, 201);
    const conflictCode = codes.at(-1);
    await prisma.user.update({ where: { id: other.id }, data: { email: pendingEmail } });
    assert.equal((await api('/users/me/contact/email/confirmar', 'POST', { code: conflictCode })).status, 409);
    assert.equal((await api('/auth/me')).data.email, newEmail);
    const disabledProviderTarget = '+55119' + String(crypto.randomInt(10000000, 99999999));
    process.env.NODE_ENV = 'production';
    assert.equal((await request('/users/me/contact/phone/solicitar', 'POST', { target: disabledProviderTarget }, otherLogin.data.token)).status, 503);
    process.env.NODE_ENV = 'development';
    assert.equal((await request('/auth/me', 'GET', undefined, otherLogin.data.token)).data.pending.phone, undefined);
    const records = await prisma.contactVerification.count({ where: { userId: user.id, type: 'email' } });
    for (let i = records; i < 5; i++) await prisma.contactVerification.create({ data: { id: crypto.randomUUID(), userId: user.id, type: 'email', target: newEmail, codeHash: '0'.repeat(64), expiresAt: new Date(0), usedAt: new Date(), createdAt: new Date(Date.now() - 61000) } });
    await prisma.contactVerification.updateMany({ where: { userId: user.id, type: 'email' }, data: { createdAt: new Date(Date.now() - 61000) } });
    assert.equal((await api('/users/me/contact/email/solicitar', 'POST', { target: email })).status, 429);
    t.diagnostic('Persistência, SMTP local, SMS console, erros, expiração, reenvio, cancelamento, unicidade, autorização e confirmação concorrente aprovados.');
  } finally {
    console.info = originalInfo;
    for (const account of [user, other]) if (account) await prisma.user.delete({ where: { id: account.id } });
    server.close(); smtp.close(); await prisma.$disconnect();
  }
});
