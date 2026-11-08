import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { e2eDir } from './lib/env.mjs';

const web = Number(process.env.E2E_WEB_PORT ?? 5183);
// E2E_SPEC=asaas roda só os testes de pagamento pelo Asaas simulado (a API sobe em outro modo), em celular e computador.
const asaas = process.env.E2E_SPEC === 'asaas';

// Os mesmos cenários rodam em três tamanhos de tela (celular, tablet e computador), com o Edge instalado na máquina.
const viewports = [
  { name: '375', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
  { name: '768', viewport: { width: 768, height: 1024 } },
  { name: '1280', viewport: { width: 1280, height: 900 } },
];

export default defineConfig({
  testDir: path.join(e2eDir, 'ui'),
  testMatch: asaas ? /asaas\.spec\.mjs/ : /.*\.spec\.mjs/,
  testIgnore: asaas ? [] : [/asaas\.spec\.mjs/],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json'], ['html', { outputFolder: path.join(e2eDir, 'report', asaas ? 'playwright-asaas' : 'playwright'), open: 'never' }]],
  outputDir: path.join(e2eDir, 'report', asaas ? 'playwright-artifacts-asaas' : 'playwright-artifacts'),
  use: {
    baseURL: `http://localhost:${web}/tecti/2026/gpec10/`,
    channel: 'msedge',
    locale: 'pt-BR',
    colorScheme: 'light',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: viewports.filter(({ name }) => (process.env.E2E_ONLY_PROJECT ? name === process.env.E2E_ONLY_PROJECT : !asaas || name !== '768')).map(({ name, ...use }) => ({ name, use })),
});
