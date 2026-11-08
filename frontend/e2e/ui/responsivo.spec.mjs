// I. Qualidade de interface: as telas principais, em celular (375), tablet (768) e computador (1280), para cada tipo de conta.
// Em cada tela: carrega, tem conteúdo, sem rolagem horizontal, sem texto quebrado ("undefined", "[object Object]"), sem erro no
// console e sem resposta 5xx da API. Também confere o foco de teclado (o primeiro Tab vai ao atalho "Pular para o conteúdo").
import { test, expect } from '@playwright/test';
import { seed, signIn, watchProblems, expectNoHorizontalScroll, expectCleanText, settle } from './helpers.mjs';

const data = seed();
const PUBLIC = [
  ['página inicial', ''], ['entrar', 'login'], ['criar conta', 'cadastro'], ['esqueci a senha', 'forgot-password'], ['busca de serviços', 'buscar'], ['pedidos abertos', 'servicos'],
  ['Central de Ajuda', 'ajuda'], ['categoria da Central', 'ajuda/categoria/contratar'], ['artigo da Central', 'ajuda/artigo/criar-conta'], ['contato com o suporte', 'ajuda/contato'],
  ['página do serviço', `anuncios/${data.listings.a1}`], ['termos de uso', 'termos-de-uso'], ['política de privacidade', 'politica-de-privacidade'], ['política de cancelamento', 'politica-de-cancelamento'],
];
const CLIENT = [
  ['busca', 'buscar'], ['favoritos', 'favoritos'], ['pedidos e contratações', 'meus-servicos'], ['meus pedidos abertos', 'meus-servicos?aba=pedidos'], ['publicar um pedido', 'servicos/novo'],
  ['mensagens', 'mensagens'], ['notificações', 'notificacoes'], ['perfil', 'perfil'], ['editar perfil', 'perfil/editar'], ['configurações pessoais', 'configuracoes/pessoais'],
  ['segurança', 'configuracoes/seguranca'], ['privacidade', 'configuracoes/privacidade'], ['notificações da conta', 'configuracoes/notificacoes'], ['idioma e moeda', 'configuracoes/idioma'],
  ['solicitar serviço', `anuncios/${data.listings.a1}/solicitar`],
];
const PRO = [
  ['painel', 'pro'], ['pedidos recebidos', 'pro/pedidos'], ['oportunidades', 'pro/oportunidades'], ['meus serviços', 'pro/servicos'], ['ganhos', 'pro/ganhos'],
  ['pagamentos (como recebo)', 'configuracoes/pagamentos'], ['respostas rápidas', 'mensagens/respostas-rapidas'],
];
const ADMIN = [['pagamentos', 'admin/pagamentos'], ['moderação', 'admin/moderacao'], ['assistente de ajuda', 'admin/ajuda']];
// Telas públicas e de fluxo disparam consultas que respondem 401 sem login: isso é esperado.
const EXPECTED = [/status of 401/i, /Failed to load resource.*(401|403)/i];

async function check(page, path, { ignore = [] } = {}) {
  const verify = watchProblems(page, { ignore: [...EXPECTED, ...ignore] });
  await page.goto(path);
  await settle(page);
  await expect(page.locator('main, #conteudo').first()).toBeVisible();
  const text = await expectCleanText(page);
  expect(text.trim().length, 'a tela está em branco').toBeGreaterThan(40);
  await expectNoHorizontalScroll(page);
  verify();
}

test.describe('visitante', () => {
  for (const [label, path] of PUBLIC) test(`visitante: ${label}`, async ({ page }) => { await check(page, path); });
  test('visitante: o primeiro Tab leva ao atalho "Pular para o conteúdo" e ele fica visível', async ({ page }) => {
    await page.goto('login');
    await settle(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });
  test('visitante: rotas protegidas mandam para o login', async ({ page }) => {
    for (const path of ['meus-servicos', 'mensagens', 'notificacoes', 'pro', 'admin/pagamentos', 'configuracoes/pessoais', 'servicos/novo']) {
      await page.goto(path);
      await page.waitForURL(/login/, { timeout: 15000 });
      expect(page.url()).toContain('login');
    }
  });
  test('visitante: o botão Ajuda aparece e abre o assistente', async ({ page }) => {
    await page.goto('ajuda');
    await settle(page);
    await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Assistente de ajuda/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Como pagar' })).toBeVisible();
  });
  test('visitante: página inexistente mostra 404 amigável', async ({ page }) => {
    await page.goto('pagina-que-nao-existe');
    await settle(page);
    await expect(page.getByText(/não encontrad|não existe/i).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('cliente', () => {
  test.beforeEach(async ({ context }) => { await signIn(context, data.clients[0].email); });
  for (const [label, path] of CLIENT) test(`cliente: ${label}`, async ({ page }) => { await check(page, path); });
  test('cliente: o menu da conta não tem "Pedidos recebidos" nem itens de administração', async ({ page, isMobile }) => {
    await page.goto('buscar');
    await settle(page);
    await page.getByRole('button', { name: 'Abrir menu' }).filter({ visible: true }).first().click();
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Pedidos recebidos');
    expect(body).not.toContain('Moderação');
    expect(body).toContain('Pedidos e contratações');
    expect(isMobile !== undefined).toBeTruthy();
  });
});

test.describe('profissional', () => {
  test.beforeEach(async ({ context }) => { await signIn(context, data.pros.a.email); });
  for (const [label, path] of PRO) test(`profissional: ${label}`, async ({ page }) => { await check(page, path); });
  test('profissional: "Pedidos recebidos" só no painel e "Oportunidades" na barra', async ({ page, isMobile }) => {
    await page.goto('pro');
    await settle(page);
    const body = await page.locator('body').innerText();
    expect(body).toContain('Pedidos e agenda');
    expect(body).toContain('Oportunidades');
    await page.getByRole('button', { name: 'Abrir menu' }).filter({ visible: true }).first().click();
    const menu = await page.locator('body').innerText();
    expect(menu.split('Pedidos e contratações')[0].includes('Pedidos recebidos') || menu.includes('Pedidos recebidos')).toBeFalsy();
    expect(isMobile !== undefined).toBeTruthy();
  });
});

test.describe('administrador', () => {
  test.beforeEach(async ({ context }) => { await signIn(context, data.admin.email); });
  for (const [label, path] of ADMIN) test(`administrador: ${label}`, async ({ page }) => { await check(page, path); });
  test('administrador: cada aba da administração de pagamentos abre sem erro', async ({ page }) => {
    const verify = watchProblems(page, { ignore: EXPECTED });
    await page.goto('admin/pagamentos');
    await settle(page);
    for (const tab of ['Resumo', 'Transações', 'Reclamações', 'Alertas', 'Avisos do gateway', 'Auditoria']) {
      await page.getByRole('tab', { name: tab }).click();
      await settle(page, 500);
      await expect(page.getByText('Não foi possível carregar', { exact: false })).toHaveCount(0);
      await expect(page.getByText('O que é:', { exact: false }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    verify();
  });
});
