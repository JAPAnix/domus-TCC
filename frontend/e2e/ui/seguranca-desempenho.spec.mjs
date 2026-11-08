// H33/I36: nenhum segredo no pacote do site, nada de HTML perigoso no código, e desempenho básico (tempo de carregamento,
// tamanho dos arquivos, imagens preguiçosas e nenhuma requisição repetida em laço).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { seed, signIn, settle } from './helpers.mjs';
import { frontendDir } from '../lib/env.mjs';

const data = seed();

test('pacote do site: nenhum segredo ou chave privada dentro dos arquivos publicados', async ({ page, request }) => {
  const html = await (await request.get('')).text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
  expect(assets.length).toBeGreaterThan(0);
  // Os módulos carregados sob demanda também entram na conta: abre as telas principais e junta tudo que o navegador baixou.
  const downloaded = new Set();
  page.on('response', (response) => { if (/\.js(\?|$)/.test(response.url())) downloaded.add(response.url()); });
  for (const route of ['', 'login', 'buscar', 'ajuda']) { await page.goto(route); await settle(page, 300); }
  const patterns = [
    [/xkeysib-[0-9a-f]{20,}/i, 'chave da Brevo'], [/xsmtpsib-/i, 'chave SMTP da Brevo'], [/\$aact_[A-Za-z0-9_]{10,}/, 'chave do Asaas'], [/sk_(live|test)_[0-9a-zA-Z]{10,}/, 'chave Stripe'],
    [/BEGIN (RSA |EC )?PRIVATE KEY/, 'chave privada'], [/JWT_SECRET|SECRETS_KEY|ASAAS_API_KEY|ASAAS_WEBHOOK_TOKEN|CLOUDINARY_API_SECRET|BREVO_API_KEY|DATABASE_PASSWORD/, 'nome de variável secreta'],
    [/mysql:\/\/[^"'\s]+:[^"'\s]+@/, 'senha de banco na URL'], [/MP_ACCESS_TOKEN|MP_WEBHOOK_SECRET/, 'segredo do Mercado Pago'],
  ];
  const found = [];
  for (const url of downloaded) {
    const text = await (await request.get(url)).text();
    for (const [pattern, label] of patterns) if (pattern.test(text)) found.push(`${label} em ${url.split('/').pop()}`);
  }
  expect(downloaded.size).toBeGreaterThan(0);
  expect(found, found.join('\n')).toEqual([]);
});

test('código-fonte: sem dangerouslySetInnerHTML nem eval (o texto do usuário é sempre escapado)', async () => {
  const hits = [];
  const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(jsx?|mjs)$/.test(entry.name)) { const text = fs.readFileSync(full, 'utf8'); if (/dangerouslySetInnerHTML|\beval\(|new Function\(|\.innerHTML\s*=/.test(text)) hits.push(path.relative(frontendDir, full)); } } };
  walk(path.join(frontendDir, 'src'));
  expect(hits, hits.join('\n')).toEqual([]);
});

test('desempenho: telas principais carregam rápido, sem requisição repetida em laço e com imagens preguiçosas', async ({ page, context }) => {
  await signIn(context, data.clients[0].email);
  const budget = [['buscar', 6000], ['meus-servicos', 6000], ['mensagens', 6000], ['notificacoes', 6000], [`anuncios/${data.listings.a1}`, 7000], ['ajuda', 5000]];
  for (const [route, limit] of budget) {
    const counts = new Map();
    const onRequest = (request) => { if (/\/api\//.test(request.url())) { const key = `${request.method()} ${request.url().replace(/^https?:\/\/[^/]+/, '')}`; counts.set(key, (counts.get(key) ?? 0) + 1); } };
    page.on('request', onRequest);
    const started = Date.now();
    await page.goto(route);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main, #conteudo').first()).toBeVisible();
    const elapsed = Date.now() - started;
    expect(elapsed, `${route} demorou ${elapsed} ms para aparecer`).toBeLessThan(limit);
    await page.waitForTimeout(6000);
    page.off('request', onRequest);
    const repeated = [...counts].filter(([, total]) => total > 6);
    expect(repeated, `requisições repetidas em ${route}: ${JSON.stringify(repeated)}`).toEqual([]);
  }
  await page.goto('buscar');
  await settle(page);
  const eager = await page.evaluate(() => [...document.querySelectorAll('main img')].slice(3).filter((img) => img.loading !== 'lazy').length);
  expect(eager, 'imagens abaixo da dobra sem loading=lazy').toBe(0);
});

test('desempenho: nenhum arquivo do site passa de 700 KB e a compressão do servidor de produção fica a cargo da hospedagem', async ({ page }) => {
  const sizes = [];
  page.on('response', async (response) => { if (/\.(js|css)(\?|$)/.test(response.url())) { const body = await response.body().catch(() => null); if (body) sizes.push([response.url().split('/').pop(), body.length]); } });
  await page.goto('');
  await settle(page, 300);
  await page.goto('buscar');
  await settle(page, 300);
  const biggest = sizes.sort((a, b) => b[1] - a[1])[0];
  expect(biggest, 'nenhum arquivo medido').toBeTruthy();
  expect(biggest[1], `${biggest[0]} tem ${Math.round(biggest[1] / 1024)} KB`).toBeLessThan(700 * 1024);
});
