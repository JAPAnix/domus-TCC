// F. Painel do profissional pela interface: alternar entre "Vou trabalhar" e "Vou contratar", criar anúncio (passo a passo),
// pausar e publicar de novo, e o caminho do perfil ("Editar" leva à edição).
import { test, expect } from '@playwright/test';
import { seed, signIn, watchProblems, expectNoHorizontalScroll, settle } from './helpers.mjs';

const data = seed();
const EXPECTED = [/status of 40[0-9]/i, /Failed to load resource.*(401|403|404|409|422)/i];

test('modo: alternar entre "Vou trabalhar" e "Vou contratar" sem perder a sessão', async ({ page, context }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  await signIn(context, data.pros.a.email);
  await page.goto('pro');
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Área do profissional' })).toBeVisible();
  await page.getByRole('button', { name: 'Vou contratar' }).first().click();
  await settle(page);
  expect(new URL(page.url()).pathname).not.toMatch(/\/pro(\/|$)/);
  await expect(page.getByRole('button', { name: 'Vou trabalhar' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Vou trabalhar' }).first().click();
  await page.waitForURL(/\/pro$/);
  await expect(page.getByRole('heading', { name: 'Área do profissional' })).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem('token'))).toBe(true);
  verify();
});

test('cliente sem perfil profissional: "Vou trabalhar" leva ao começo do cadastro de profissional', async ({ page, context }) => {
  await signIn(context, data.clients[2].email);
  await page.goto('buscar');
  await settle(page);
  await page.getByRole('button', { name: 'Vou trabalhar' }).first().click();
  await page.waitForURL(/pro\/comecar/);
  await expectNoHorizontalScroll(page);
  // Entrar direto na área do profissional sem ter perfil: aviso claro com o caminho para começar (não tela em branco nem erro).
  await page.goto('pro');
  await settle(page);
  await expect(page.getByText('Esta área é para profissionais')).toBeVisible();
  await expect(page.getByRole('link', { name: /Começar a oferecer serviços/ })).toBeVisible();
});

test('meus serviços: lista os anúncios, cria um novo (passo a passo), pausa e publica de novo', async ({ page, context }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  await signIn(context, data.pros.b.email);
  await page.goto('pro/servicos');
  await settle(page);
  await expect(page.getByText('TESTE-Limpeza de sofá').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  const card = page.getByRole('listitem').filter({ hasText: 'TESTE-Limpeza de sofá' }).first();
  await card.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'TESTE-Limpeza de sofá' }).first().getByRole('button', { name: 'Publicar de novo' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('listitem').filter({ hasText: 'TESTE-Limpeza de sofá' }).first().getByRole('button', { name: 'Publicar de novo' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'TESTE-Limpeza de sofá' }).first().getByRole('button', { name: 'Pausar' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Novo anúncio' }).click();
  await page.waitForURL(/pro\/anuncio\/[0-9a-f-]{36}/);
  await settle(page);
  await expect(page.locator('main').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Avançar$/ }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  verify();
});

test('perfil: o botão Editar leva à edição do perfil', async ({ page, context }) => {
  await signIn(context, data.clients[0].email);
  await page.goto('perfil');
  await settle(page);
  await page.getByRole('link', { name: /^Editar$|Preencher agora/ }).first().click();
  await page.waitForURL(/perfil\/editar/);
  await expect(page.getByRole('heading', { name: 'Meu perfil', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Escolher foto' })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
