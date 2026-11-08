// B. Descoberta (modo cliente): busca, filtros, ordenação, estados vazios, página do serviço e favoritos (persistem ao recarregar).
import { test, expect } from '@playwright/test';
import { seed, signIn, watchProblems, expectNoHorizontalScroll, expectCleanText, settle } from './helpers.mjs';
import { API_URL } from '../lib/env.mjs';

const data = seed();
const EXPECTED = [/status of 40[0-9]/i, /Failed to load resource.*(400|401|403|404)/i];

test('busca: lista os serviços, ordena por preço e filtra por faixa', async ({ page, context }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  await signIn(context, data.clients[0].email);
  await page.goto('buscar');
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('ul li a, ul li article').first()).toBeVisible();
  await expectCleanText(page);
  await page.goto('buscar?precoMax=100&ordem=price_asc');
  await settle(page);
  await expect(page.getByText('TESTE-Limpeza de sofá').first()).toBeVisible();
  await expect(page.getByText('TESTE-Instalação de chuveiro elétrico')).toHaveCount(0);
  await page.goto('buscar?precoMin=140&ordem=price_desc');
  await settle(page);
  await expect(page.getByText('TESTE-Instalação de chuveiro elétrico').first()).toBeVisible();
  await expect(page.getByText('TESTE-Limpeza de sofá')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  verify();
});

test('busca: sem resultado mostra o estado vazio com saída (publicar um pedido)', async ({ page, context }) => {
  await signIn(context, data.clients[0].email);
  await page.goto('buscar?cidade=Cidade-Que-Nao-Existe-XYZ&categoria=999999');
  await settle(page);
  const body = await page.locator('main').innerText();
  expect(body).toMatch(/Nenhum serviço encontrado|Não foi possível|inválido/i);
  await expectNoHorizontalScroll(page);
});

test('página do serviço: galeria, preço, disponibilidade, avaliação, profissional e cartão de contratação', async ({ page, context }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  await signIn(context, data.clients[1].email);
  await page.goto(`anuncios/${data.listings.a1}`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Instalação de chuveiro elétrico');
  expect(await page.locator('main img').count()).toBeGreaterThanOrEqual(3);
  for (const heading of ['Preço', 'Disponibilidade', 'Conheça seu profissional']) await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  if (data.reviewed) {
    await expect(page.getByRole('heading', { name: 'Avaliações' })).toBeVisible();
    await expect(page.getByText('TESTE-Serviço excelente, pontual e caprichado.')).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Solicitar|Contratar|Ver disponibilidade|Reservar/ }).first()).toBeVisible();
  const text = await expectCleanText(page);
  expect(text).not.toMatch(/@teste\.invalid/);
  await expectNoHorizontalScroll(page);
  verify();
});

test('página do serviço: anúncio inexistente mostra aviso amigável', async ({ page }) => {
  await page.goto('anuncios/00000000-0000-4000-8000-000000000000');
  await settle(page);
  await expect(page.getByText(/não encontrad|não está disponível|não existe/i).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('favoritos: salvar e remover pelo coração, e a lista persiste depois de recarregar', async ({ page, context }) => {
  const verify = watchProblems(page, { ignore: EXPECTED });
  const { token } = await signIn(context, data.clients[2].email);
  // Começa sem favoritos (o teste roda uma vez por tamanho de tela, com a mesma conta).
  const lists = await (await fetch(`${API_URL}/favorites`, { headers: { authorization: `Bearer ${token}` } })).json();
  for (const list of lists.lists ?? []) await fetch(`${API_URL}/favorites/lists/${list.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  await fetch(`${API_URL}/favorites/item`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'listing', uuid: data.listings.b1, list_ids: [] }) });
  await page.goto('buscar?precoMax=100&ordem=price_asc');
  await settle(page);
  const card = page.locator('li', { hasText: 'TESTE-Limpeza de sofá' }).first();
  const heart = card.getByRole('button', { name: /favoritos/ });
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  const dialog = page.getByRole('dialog', { name: 'Salvar em lista' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome da nova lista').fill('TESTE-Para depois');
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await dialog.getByLabel('TESTE-Para depois').check();
  await dialog.getByRole('button', { name: 'Concluído' }).click();
  await expect(page.getByText('Salvo nos seus favoritos.')).toBeVisible();
  await page.reload();
  await settle(page);
  await expect(page.locator('li', { hasText: 'TESTE-Limpeza de sofá' }).first().getByRole('button', { name: /favoritos/ })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('favoritos');
  await settle(page);
  await expect(page.getByText('TESTE-Para depois')).toBeVisible();
  await page.getByText('TESTE-Para depois').first().click();
  await settle(page);
  await expect(page.getByText('TESTE-Limpeza de sofá')).toBeVisible();
  await expectNoHorizontalScroll(page);
  verify();
});
