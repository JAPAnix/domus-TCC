import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrom, sendPasswordResetEmail, sendPlainEmail, smtpConfigured } from '../src/services/emailService.js';

const saved = { ...process.env };
const restore = () => { for (const key of ['BREVO_API_KEY', 'SMTP_HOST', 'EMAIL_FROM']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } };

test('remetente: separa nome e e-mail', () => {
  assert.deepEqual(parseFrom('Dommos <oi@exemplo.com>'), { name: 'Dommos', email: 'oi@exemplo.com' });
  assert.deepEqual(parseFrom('"Dommos App" <oi@exemplo.com>'), { name: 'Dommos App', email: 'oi@exemplo.com' });
  assert.deepEqual(parseFrom('oi@exemplo.com'), { email: 'oi@exemplo.com' });
});

test('envio configurado com a API da Brevo ou com SMTP, sempre com remetente', () => {
  restore(); delete process.env.BREVO_API_KEY; delete process.env.SMTP_HOST; delete process.env.EMAIL_FROM;
  assert.equal(smtpConfigured(), false);
  process.env.EMAIL_FROM = 'Dommos <oi@exemplo.com>';
  assert.equal(smtpConfigured(), false);
  process.env.BREVO_API_KEY = 'chave-de-teste';
  assert.equal(smtpConfigured(), true);
  restore();
});

test('Brevo: a recuperação de senha sai por HTTPS, com a chave no cabeçalho e sem SMTP', async () => {
  process.env.BREVO_API_KEY = 'chave-de-teste'; process.env.EMAIL_FROM = 'Dommos <oi@exemplo.com>'; delete process.env.SMTP_HOST;
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 201 }); };
  try {
    await sendPasswordResetEmail({ email: 'pessoa@exemplo.com', link: 'https://site.example/reset?token=abc' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(calls[0].init.headers['api-key'], 'chave-de-teste');
    const body = JSON.parse(calls[0].init.body);
    assert.deepEqual(body.sender, { name: 'Dommos', email: 'oi@exemplo.com' });
    assert.deepEqual(body.to, [{ email: 'pessoa@exemplo.com' }]);
    assert.match(body.htmlContent, /token=abc/);
  } finally { globalThis.fetch = realFetch; restore(); }
});

test('Brevo: recusa vira erro sem vazar a chave', async () => {
  process.env.BREVO_API_KEY = 'chave-secreta-123'; process.env.EMAIL_FROM = 'oi@exemplo.com';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"message":"sender not valid"}', { status: 400 });
  try {
    await assert.rejects(sendPlainEmail({ to: 'a@b.com', subject: 'x', text: 'y' }), (error) => error.status === 502 && !error.message.includes('chave-secreta-123') && /400/.test(error.message));
  } finally { globalThis.fetch = realFetch; restore(); }
});
