// A. Conta e acesso pela interface: cadastro, login, logout, rota protegida, "esqueci minha senha" (link lido do log de teste) e foto de perfil.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { seed, signIn, PW, watchProblems, expectNoHorizontalScroll, settle } from './helpers.mjs';

const EXPECTED = [/status of 40[0-9]/i, /Failed to load resource.*(400|401|403|409|422|429)/i];
const data = seed();
const unique = (info) => `${info.project.name}${Date.now().toString().slice(-7)}`;

test('cadastro: valida a senha, cria a conta e entra', async ({ page }, info) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  const email = `teste-ui-${unique(info)}@teste.invalid`;
  await page.goto('cadastro');
  await settle(page);
  await page.locator('input[name="first_name"]').fill('TESTE');
  await page.locator('input[name="last_name"]').fill('Interface');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill('curta');
  await page.getByRole('button', { name: /Criar conta/ }).click();
  await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.locator('input[name="password"]').fill(PW);
  await page.getByRole('button', { name: /Criar conta/ }).click();
  await page.waitForURL((url) => !/cadastro/.test(url.pathname), { timeout: 20000 });
  expect(await page.evaluate(() => !!localStorage.getItem('token'))).toBe(true);
  verify();
});

test('cadastro: e-mail repetido mostra erro claro (sem travar a tela)', async ({ page }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  await page.goto('cadastro');
  await page.locator('input[name="first_name"]').fill('TESTE');
  await page.locator('input[name="last_name"]').fill('Repetido');
  await page.locator('input[name="email"]').fill(data.clients[0].email);
  await page.locator('input[name="password"]').fill(PW);
  await page.getByRole('button', { name: /Criar conta/ }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Criar conta/ })).toBeEnabled();
  verify();
});

test('login: senha errada avisa; senha certa entra; sair encerra a sessão e protege as rotas', async ({ page }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  await page.goto('login');
  await settle(page);
  await page.getByLabel('E-mail').fill(data.clients[0].email);
  await page.getByLabel('Senha').fill('senha-errada-9');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText(/senha.*errada|usuário não existe/i);
  await page.getByLabel('Senha').fill(PW);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !/login/.test(url.pathname), { timeout: 20000 });
  expect(await page.evaluate(() => !!localStorage.getItem('token'))).toBe(true);
  await page.goto('meus-servicos');
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Pedidos e contratações' })).toBeVisible();
  await page.goto('sair');
  await page.waitForURL(/login/, { timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await page.goto('meus-servicos');
  await page.waitForURL(/login/, { timeout: 15000 });
  verify();
});

test('sessão expirada: token inválido leva ao login sem tela quebrada', async ({ page, context }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  await context.addInitScript(() => { localStorage.setItem('token', 'token.invalido.expirado'); localStorage.setItem('user', JSON.stringify({ uuid: 'x', firstName: 'Teste', roles: ['client'] })); });
  await page.goto('meus-servicos');
  await page.waitForURL(/login/, { timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  verify();
});

test('esqueci minha senha: pede o link, redefine pelo link do log de teste, o link não vale duas vezes', async ({ page }, info) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  const email = `teste-recup-${unique(info)}@teste.invalid`;
  const created = await fetch(`${process.env.E2E_API ?? `http://localhost:${process.env.E2E_API_PORT ?? 3100}/api`}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ first_name: 'TESTE', last_name: 'Recuperacao', email, password: PW }) });
  expect(created.status).toBe(201);
  await page.goto('forgot-password');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('status')).toContainText('Se existir uma conta com este e-mail');
  await page.waitForTimeout(800);
  const log = fs.readFileSync(process.env.E2E_API_LOG, 'utf8');
  const match = [...log.matchAll(new RegExp(`Link de redefinição de senha para ${email.replace(/[.+]/g, '\\$&')}: (\\S+)`, 'g'))].at(-1);
  expect(match, 'o link de teste não apareceu no log').toBeTruthy();
  const token = new URL(match[1]).searchParams.get('token');
  await page.goto(`reset-password?token=${token}`);
  await settle(page);
  const fields = page.locator('input[type="password"]');
  await fields.first().fill('NovaSenha-123');
  if ((await fields.count()) > 1) await fields.nth(1).fill('NovaSenha-123');
  await page.getByRole('button', { name: /Redefinir|Salvar|Criar/ }).click();
  await expect(page.getByText(/senha (foi )?(redefinida|alterada|atualizada)|já pode entrar/i).first()).toBeVisible({ timeout: 15000 });
  await page.goto(`reset-password?token=${token}`);
  await fields.first().fill('OutraSenha-456');
  if ((await fields.count()) > 1) await fields.nth(1).fill('OutraSenha-456');
  await page.getByRole('button', { name: /Redefinir|Salvar|Criar/ }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.goto('login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('NovaSenha-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !/login/.test(url.pathname), { timeout: 20000 });
  verify();
});

test('foto de perfil: arquivo que não é imagem e arquivo grande demais são recusados com mensagem', async ({ page, context }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  await signIn(context, data.clients[2].email);
  await page.goto('perfil/editar');
  await settle(page);
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({ name: 'documento.txt', mimeType: 'text/plain', buffer: Buffer.from('isto não é uma imagem') });
  await expect(page.getByText(/não foi aceito|Envie uma imagem JPG, PNG ou WebP/)).toBeVisible();
  await input.setInputFiles({ name: 'enorme.png', mimeType: 'image/png', buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(6 * 1024 * 1024)]) });
  await expect(page.getByText(/mais de 5 MB/)).toBeVisible();
  await expectNoHorizontalScroll(page);
  verify();
});

test('configurações: só opções de serviço, e idioma e moeda são apenas português e real', async ({ page, context }) => {
  await signIn(context, data.clients[0].email);
  await page.goto('configuracoes/idioma');
  await settle(page);
  const body = await page.locator('main').innerText();
  expect(body).toMatch(/Real|BRL/);
  expect(body).not.toMatch(/Dólar|USD|Euro|EUR|English/i);
  await page.goto('configuracoes/pessoais');
  await settle(page);
  const settings = await page.locator('body').innerText();
  expect(settings).not.toMatch(/hóspede|reserva de hospedagem|anfitri/i);
});
