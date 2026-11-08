// E. Mensagens em tempo real com duas sessões ao mesmo tempo: envio, chegada sem recarregar, contador que some ao abrir,
// imagem, ordem das mensagens e reconexão depois de uma queda de rede.
import zlib from 'node:zlib';
import { test, expect } from '@playwright/test';
import { seed, signIn, apiLogin, watchProblems, expectNoHorizontalScroll, settle } from './helpers.mjs';
import { API_URL } from '../lib/env.mjs';

const data = seed();
const EXPECTED = [/status of 40[0-9]/i, /Failed to load resource.*(401|403|404)/i, /WebSocket/i, /net::ERR_INTERNET_DISCONNECTED/i, /Failed to load resource: net::ERR/i];
const api = async (method, route, body, token) => {
  const response = await fetch(API_URL + route, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => null) };
};
const png = () => {
  const table = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buffer) => { let c = ~0; for (const byte of buffer) c = table[(c ^ byte) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type, content) => { const length = Buffer.alloc(4); length.writeUInt32BE(content.length); const body = Buffer.concat([Buffer.from(type), content]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, sum]); };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 120, 60, 200]))), chunk('IEND', Buffer.alloc(0))]);
};

test('conversa em tempo real entre cliente e profissional, com contador, imagem e reconexão', async ({ browser }, info) => {
  test.setTimeout(240_000);   // inclui a espera da reconexão depois da queda de rede
  const tag = `${info.project.name}-${Date.now().toString().slice(-6)}`;
  const clientAuth = await apiLogin(data.clients[1].email);
  const proAuth = await apiLogin(data.pros.a.email);
  const conversation = (await api('POST', '/conversations', { listing_uuid: data.listings.a2 }, clientAuth.token)).data.uuid;
  expect(conversation).toBeTruthy();

  const clientCtx = await browser.newContext(); await signIn(clientCtx, data.clients[1].email);
  const proCtx = await browser.newContext(); await signIn(proCtx, data.pros.a.email);
  const clientPage = await clientCtx.newPage(), proPage = await proCtx.newPage();
  const verifyClient = watchProblems(clientPage, { ignore: EXPECTED }), verifyPro = watchProblems(proPage, { ignore: EXPECTED });
  // A conversa aberta (e não o resumo dela na lista ao lado).
  const inChat = (page, text) => page.locator('section[aria-label^="Conversa com"]').getByText(text);

  // Outros testes deixam mensagens não lidas para este profissional: o que importa é voltar ao número de antes.
  const baseline = (await api('GET', '/conversations/unread-count', null, proAuth.token)).data.count;
  // O profissional está na lista de conversas; o cliente abre a conversa.
  await proPage.goto('mensagens');
  await settle(proPage);
  await clientPage.goto(`mensagens/${conversation}`);
  await settle(clientPage);
  const box = clientPage.getByPlaceholder('Escreva sua mensagem');
  await box.fill(`Olá, mensagem 1 ${tag}`);
  await clientPage.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(inChat(clientPage, `Olá, mensagem 1 ${tag}`)).toBeVisible();

  // Chega para o profissional sem recarregar, e o contador de não lidas aparece.
  await expect(proPage.getByText(`Olá, mensagem 1 ${tag}`).first()).toBeVisible({ timeout: 30000 });
  expect((await api('GET', '/conversations/unread-count', null, proAuth.token)).data.count).toBeGreaterThanOrEqual(baseline + 1);

  // Ao abrir a conversa, o contador some (no servidor também) e a resposta chega ao cliente em tempo real.
  await proPage.getByText(`Olá, mensagem 1 ${tag}`).first().click();
  await expect(proPage.getByPlaceholder('Escreva sua mensagem')).toBeVisible();
  await expect.poll(async () => (await api('GET', '/conversations/unread-count', null, proAuth.token)).data.count, { timeout: 20000 }).toBe(baseline);
  await proPage.getByPlaceholder('Escreva sua mensagem').fill(`Resposta 2 ${tag}`);
  await proPage.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(inChat(clientPage, `Resposta 2 ${tag}`)).toBeVisible({ timeout: 30000 });

  // Imagem.
  await clientPage.getByRole('button', { name: 'Foto' }).click();
  await clientPage.locator('input[type="file"]').last().setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png() });
  await expect(clientPage.getByRole('button', { name: 'Enviar', exact: true })).toBeEnabled({ timeout: 20000 });
  await clientPage.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(proPage.getByAltText('Foto enviada na conversa').first()).toBeVisible({ timeout: 30000 });
  // Diagnóstico de instabilidade: depois de enviar a foto o botão "Enviar" precisa voltar ao normal em poucos segundos.
  const sendButton = clientPage.getByRole('button', { name: 'Enviar', exact: true });
  const calm = await expect(sendButton).not.toHaveAttribute('aria-busy', 'true', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!calm) {
    const pending = await clientPage.evaluate(() => performance.getEntriesByType('resource').filter((entry) => !entry.responseEnd || entry.responseEnd === 0).map((entry) => entry.name.replace(/^https?:\/\/[^/]+/, '')));
    const stored = await api('GET', `/conversations/${conversation}`, null, clientAuth.token);
    console.log(`DIAGNÓSTICO: botão preso. Requisições sem resposta: ${JSON.stringify(pending)}. Mensagens no servidor: ${stored.data?.messages?.length}`);
  }
  expect(calm, 'o botão Enviar ficou preso em "carregando" depois de enviar a foto').toBe(true);

  // Ordem das mensagens: a mais nova fica por último.
  const order = await proPage.locator('[role="log"], section[aria-label^="Conversa"]').first().innerText();
  expect(order.indexOf(`mensagem 1 ${tag}`)).toBeLessThan(order.indexOf(`Resposta 2 ${tag}`));

  // Queda de rede: o profissional fica offline, o cliente escreve, e a mensagem chega quando a rede volta.
  await proCtx.setOffline(true);
  await clientPage.getByPlaceholder('Escreva sua mensagem').fill(`Durante a queda 3 ${tag}`);
  await clientPage.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(inChat(clientPage, `Durante a queda 3 ${tag}`)).toBeVisible();
  await proPage.waitForTimeout(1500);
  await expect(inChat(proPage, `Durante a queda 3 ${tag}`)).toHaveCount(0);
  await proCtx.setOffline(false);
  const backOnline = Date.now();
  await expect(inChat(proPage, `Durante a queda 3 ${tag}`)).toBeVisible({ timeout: 90000 });
  const reconnectMs = Date.now() - backOnline;
  console.log(`reconexão: a mensagem chegou ${Math.round(reconnectMs / 1000)} s depois da rede voltar`);
  expect(reconnectMs, 'a reconexão demorou demais').toBeLessThan(60000);
  await expectNoHorizontalScroll(proPage); await expectNoHorizontalScroll(clientPage);

  // Outra conta não entra na conversa.
  const spyCtx = await browser.newContext(); await signIn(spyCtx, data.clients[2].email);
  const spy = await spyCtx.newPage();
  await spy.goto(`mensagens/${conversation}`);
  await settle(spy);
  await expect(spy.locator('section[aria-label^="Conversa com"]')).toHaveCount(0);

  verifyClient(); verifyPro();
  await clientCtx.close(); await proCtx.close(); await spyCtx.close();
});

// Regressão: o texto digitado enquanto a mensagem anterior ainda está sendo enviada não pode ser apagado quando o envio termina.
test('o que a pessoa digita durante um envio lento não se perde', async ({ browser }, info) => {
  const clientAuth = await apiLogin(data.clients[2].email);
  const conversation = (await api('POST', '/conversations', { listing_uuid: data.listings.a3 }, clientAuth.token)).data.uuid;
  const ctx = await browser.newContext(); await signIn(ctx, data.clients[2].email);
  const page = await ctx.newPage();
  await page.route('**/conversations/*/messages', async (route) => { if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 2500)); await route.continue(); });
  await page.goto(`mensagens/${conversation}`);
  await settle(page);
  const box = page.getByPlaceholder('Escreva sua mensagem');
  await box.fill(`Primeira ${info.project.name}`);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toHaveAttribute('aria-busy', 'true');
  await box.fill(`Segunda, digitada durante o envio ${info.project.name}`);
  await expect(page.getByRole('button', { name: 'Enviar', exact: true })).not.toHaveAttribute('aria-busy', 'true', { timeout: 15000 });
  await expect(box).toHaveValue(`Segunda, digitada durante o envio ${info.project.name}`);
  await ctx.close();
});
