import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { requestPasswordReset, resetPassword, RESET_TTL_MS } from '../src/services/passwordReset.js';
import { passwordSchema } from '../src/validators/passwordRules.js';
import { forgotPasswordSchema, registerSchema, resetPasswordSchema } from '../src/validators/authValidator.js';
import { byIpAndEmail, rateLimit } from '../src/middleware/rateLimit.js';

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const NOW = new Date('2026-11-07T12:00:00.000Z');

// Banco em memória com as mesmas regras de filtro que o serviço usa.
function fakeDb({ users = [], sessions = [] } = {}) {
  const tokens = [];
  let nextId = 1n;
  return {
    tokens, users, sessions,
    user: {
      findFirst: async ({ where }) => users.find((user) => (where.email === undefined || user.email === where.email) && (where.id === undefined || user.id === where.id) && (where.deletedAt !== null || !user.deletedAt)) ?? null,
      update: async ({ where, data }) => { Object.assign(users.find((user) => user.id === where.id), data); },
    },
    passwordResetToken: {
      create: async ({ data }) => { tokens.push({ id: nextId++, usedAt: null, ...data }); },
      findFirst: async ({ where }) => tokens.find((t) => t.tokenHash === where.tokenHash && t.usedAt === null && t.expiresAt > where.expiresAt.gt) ?? null,
      updateMany: async ({ where, data }) => {
        const hit = tokens.filter((t) => t.usedAt === null && (where.id === undefined || t.id === where.id) && (where.userId === undefined || t.userId === where.userId) && (where.expiresAt === undefined || t.expiresAt > where.expiresAt.gt));
        hit.forEach((t) => Object.assign(t, data));
        return { count: hit.length };
      },
    },
    userSession: { updateMany: async ({ where, data }) => { const hit = sessions.filter((s) => s.userId === where.userId && s.revokedAt === null); hit.forEach((s) => Object.assign(s, data)); return { count: hit.length }; } },
    $transaction: async (operations) => Promise.all(operations),
  };
}
const maria = () => ({ id: 1n, email: 'maria@exemplo.com', firstName: 'Maria', passwordHash: 'antigo', deletedAt: null });
const base = { frontendUrl: 'https://site.example/app/', now: NOW };
const hashOf = async (password) => `hash:${password}`;

test('pedir o link: o token vai por e-mail e no banco fica só o hash, válido por 30 minutos', async () => {
  const db = fakeDb({ users: [maria()] });
  const sent = [];
  const result = await requestPasswordReset(db, { ...base, email: 'maria@exemplo.com', send: async (mail) => sent.push(mail), randomToken: () => 'a'.repeat(64) });
  assert.equal(result.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].link, `https://site.example/app/reset-password?token=${'a'.repeat(64)}`);
  assert.equal(sent[0].hasPassword, true);
  assert.equal(db.tokens[0].tokenHash, sha('a'.repeat(64)));
  assert.notEqual(db.tokens[0].tokenHash, 'a'.repeat(64));
  assert.equal(db.tokens[0].expiresAt.getTime() - NOW.getTime(), 30 * 60 * 1000);
  assert.equal(RESET_TTL_MS, 30 * 60 * 1000);
});

test('e-mail sem conta: nada é criado nem enviado (e a API responde igual)', async () => {
  const db = fakeDb({ users: [maria()] });
  const sent = [];
  const result = await requestPasswordReset(db, { ...base, email: 'ninguem@exemplo.com', send: async (mail) => sent.push(mail) });
  assert.equal(result.sent, false);
  assert.equal(sent.length, 0);
  assert.equal(db.tokens.length, 0);
});

test('pedir de novo invalida o link anterior', async () => {
  const db = fakeDb({ users: [maria()] });
  const tokens = ['1'.repeat(64), '2'.repeat(64)];
  for (const token of tokens) await requestPasswordReset(db, { ...base, email: 'maria@exemplo.com', send: async () => {}, randomToken: () => token });
  assert.equal((await resetPassword(db, { token: tokens[0], newPassword: 'nova-senha-1', hash: hashOf, now: NOW })).ok, false);
  assert.equal((await resetPassword(db, { token: tokens[1], newPassword: 'nova-senha-1', hash: hashOf, now: NOW })).ok, true);
});

test('conta criada só com o Google (sem senha): o e-mail é a variante "crie uma senha"', async () => {
  const db = fakeDb({ users: [{ ...maria(), passwordHash: null, googleId: 'g-1' }] });
  const sent = [];
  await requestPasswordReset(db, { ...base, email: 'maria@exemplo.com', send: async (mail) => sent.push(mail) });
  assert.equal(sent[0].hasPassword, false);
});

test('redefinir: troca a senha, encerra TODAS as sessões da pessoa e avisa por e-mail', async () => {
  const db = fakeDb({ users: [maria()], sessions: [{ userId: 1n, revokedAt: null }, { userId: 1n, revokedAt: null }, { userId: 2n, revokedAt: null }] });
  await requestPasswordReset(db, { ...base, email: 'maria@exemplo.com', send: async () => {}, randomToken: () => 'b'.repeat(64) });
  const notified = [];
  const result = await resetPassword(db, { token: 'b'.repeat(64), newPassword: 'nova-senha-1', hash: hashOf, notifyChanged: async (user) => notified.push(user.email), now: NOW });
  assert.equal(result.ok, true);
  assert.equal(db.users[0].passwordHash, 'hash:nova-senha-1');
  assert.deepEqual(db.sessions.map((s) => s.revokedAt !== null), [true, true, false]);
  assert.deepEqual(notified, ['maria@exemplo.com']);
});

test('token expirado não funciona', async () => {
  const db = fakeDb({ users: [maria()] });
  await requestPasswordReset(db, { ...base, email: 'maria@exemplo.com', send: async () => {}, randomToken: () => 'c'.repeat(64) });
  const late = new Date(NOW.getTime() + RESET_TTL_MS + 1000);
  assert.equal((await resetPassword(db, { token: 'c'.repeat(64), newPassword: 'nova-senha-1', hash: hashOf, now: late })).ok, false);
  assert.equal(db.users[0].passwordHash, 'antigo');
});

test('token inventado não funciona', async () => {
  const db = fakeDb({ users: [maria()] });
  assert.equal((await resetPassword(db, { token: 'd'.repeat(64), newPassword: 'nova-senha-1', hash: hashOf, now: NOW })).ok, false);
});

test('token usado duas vezes: a segunda falha, mesmo em cliques simultâneos', async () => {
  const db = fakeDb({ users: [maria()] });
  await requestPasswordReset(db, { ...base, email: 'maria@exemplo.com', send: async () => {}, randomToken: () => 'e'.repeat(64) });
  const run = () => resetPassword(db, { token: 'e'.repeat(64), newPassword: 'nova-senha-1', hash: hashOf, now: NOW });
  const results = await Promise.all([run(), run()]);
  assert.deepEqual(results.map((r) => r.ok).sort(), [false, true]);
  assert.equal((await run()).ok, false);
});

test('senha fraca é rejeitada no cadastro, na redefinição e na troca (mesma regra)', () => {
  for (const password of ['1234567', '12345678', 'password', 'SENHA123', 'aaaaaaaaa', 'abababab']) {
    assert.equal(passwordSchema().safeParse(password).success, false, password);
    assert.equal(resetPasswordSchema.safeParse({ token: 'x'.repeat(64), newPassword: password }).success, false, `redefinição: ${password}`);
    assert.equal(registerSchema.safeParse({ first_name: 'Maria', last_name: 'Silva', email: 'm@e.com', password }).success, false, `cadastro: ${password}`);
  }
  for (const password of ['nova-senha-1', 'Chuveiro#2026', 'quero um café']) assert.equal(passwordSchema().safeParse(password).success, true, password);
  assert.match(resetPasswordSchema.safeParse({ token: 'x'.repeat(64), newPassword: '1234567' }).error.issues[0].message, /pelo menos 8/);
});

test('o e-mail do pedido é validado', () => {
  assert.equal(forgotPasswordSchema.safeParse({ email: 'não é e-mail' }).success, false);
  assert.equal(forgotPasswordSchema.safeParse({ email: ' maria@exemplo.com ' }).success, true);
});

test('limite de pedidos de link: 5 por hora para o mesmo IP e e-mail, sem travar outros e-mails', () => {
  const limit = rateLimit({ limit: 5, windowMs: 60 * 60 * 1000, key: byIpAndEmail });
  const call = (email, ip = '10.0.0.1') => {
    let status = 200;
    limit({ ip, body: { email } }, { set: () => ({ status: (code) => ({ json: () => { status = code; } }) }) }, () => {});
    return status;
  };
  for (let i = 0; i < 5; i += 1) assert.equal(call('Maria@exemplo.com'), 200);
  assert.equal(call('maria@exemplo.com'), 429, 'maiúsculas e minúsculas contam como o mesmo e-mail');
  assert.equal(call('outra@exemplo.com'), 200);
  assert.equal(call('maria@exemplo.com', '10.0.0.2'), 200);
});
