// C. Pedido por anúncio, pela interface (pagamento direto/manual): o cliente solicita pelo passo a passo, o profissional aceita em
// "Pedidos recebidos", o cliente vê a área de pagamento, o profissional inicia e conclui, e o cliente consegue avaliar.
// O pagamento com Asaas (Pix, cartão, boleto, webhook, comissão) é provado pelas suítes de API contra o Asaas simulado.
import { test, expect } from '@playwright/test';
import { seed, signIn, watchProblems, expectNoHorizontalScroll, settle } from './helpers.mjs';

const data = seed();
const EXPECTED = [/status of 40[0-9]/i, /Failed to load resource.*(401|403|404|409)/i];
const isoDate = (days) => { const d = new Date(); d.setDate(d.getDate() + days); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };

test('solicitar pelo passo a passo, aceitar, pagar (direto), iniciar, concluir e avaliar', async ({ browser }, info) => {
  const offset = { '375': 6, '768': 14, '1280': 22 }[info.project.name] ?? 30;
  const clientCtx = await browser.newContext(); await signIn(clientCtx, data.clients[1].email);
  const proCtx = await browser.newContext(); await signIn(proCtx, data.pros.a.email);
  const client = await clientCtx.newPage(), pro = await proCtx.newPage();
  const verifyClient = watchProblems(client, { ignore: EXPECTED }), verifyPro = watchProblems(pro, { ignore: EXPECTED });

  // ---------- cliente solicita ----------
  await client.goto(`anuncios/${data.listings.a1}/solicitar?data=${isoDate(offset)}&modo=remote`);
  await settle(client);
  await expect(client.getByRole('heading', { name: 'Revise o seu pedido' })).toBeVisible();
  await expect(client.getByText(/R\$\s*150,00/).first()).toBeVisible();
  await expectNoHorizontalScroll(client);
  for (let i = 0; i < 6; i++) {
    if (await client.getByRole('button', { name: 'Enviar solicitação' }).isVisible()) break;
    await client.getByRole('button', { name: 'Continuar' }).click();
    await client.waitForTimeout(250);
  }
  await expect(client.getByRole('button', { name: 'Enviar solicitação' })).toBeDisabled();
  await client.getByRole('checkbox').check();
  await client.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(client.getByRole('link', { name: 'Ver pedido' })).toBeVisible({ timeout: 20000 });
  await client.getByRole('link', { name: 'Ver pedido' }).click();
  await client.waitForURL(/contratacoes\//);
  const orderUrl = client.url();
  await settle(client);
  await expect(client.getByText('Aguardando resposta').first()).toBeVisible();

  // ---------- profissional aceita em "Pedidos recebidos" ----------
  await pro.goto('pro/pedidos');
  await settle(pro);
  await expect(pro.getByRole('tab', { name: /Novos/ })).toBeVisible();
  await expect(pro.getByText('TESTE-Instalação de chuveiro elétrico').first()).toBeVisible();
  await expect(pro.getByText(/Responda em/).first()).toBeVisible();
  await pro.goto(orderUrl.replace(/^https?:\/\/[^/]+\/tecti\/2026\/gpec10\//, ''));
  await settle(pro);
  await pro.getByRole('button', { name: 'Aceitar', exact: true }).click();
  await expect(pro.getByText('Aceito').first()).toBeVisible({ timeout: 15000 });

  // ---------- cliente vê a área de pagamento ----------
  await client.reload();
  await settle(client);
  await expect(client.getByRole('heading', { name: /Pagamento/ }).first()).toBeVisible({ timeout: 15000 });
  await expectNoHorizontalScroll(client);

  // ---------- profissional inicia e conclui ----------
  await pro.reload();
  await settle(pro);
  await pro.getByRole('button', { name: 'Iniciar serviço' }).click();
  await expect(pro.getByText('Em andamento').first()).toBeVisible({ timeout: 15000 });
  await pro.getByRole('button', { name: 'Concluir serviço' }).first().click();
  const dialog = pro.getByRole('dialog', { name: 'Concluir serviço' });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByLabel(/Valor final/).fill('150');
    await dialog.getByRole('button', { name: 'Concluir serviço' }).click();
  }
  await expect(pro.getByText('Concluído').first()).toBeVisible({ timeout: 15000 });

  // ---------- cliente avalia ----------
  await client.reload();
  await settle(client);
  await expect(client.getByRole('link', { name: /Avaliar/ }).first()).toBeVisible({ timeout: 15000 });
  verifyClient(); verifyPro();
  await clientCtx.close(); await proCtx.close();
});

test('pedido de um profissional sem forma de receber: o cliente é avisado com clareza no momento de pagar', async ({ browser }, info) => {
  const offset = { '375': 7, '768': 15, '1280': 23 }[info.project.name] ?? 31;
  const clientCtx = await browser.newContext(); await signIn(clientCtx, data.clients[2].email);
  const proCtx = await browser.newContext(); await signIn(proCtx, data.pros.b.email);
  const client = await clientCtx.newPage(), pro = await proCtx.newPage();
  await client.goto(`anuncios/${data.listings.b1}/solicitar?data=${isoDate(offset)}&modo=remote`);
  await settle(client);
  for (let i = 0; i < 6; i++) {
    if (await client.getByRole('button', { name: 'Enviar solicitação' }).isVisible()) break;
    await client.getByRole('button', { name: 'Continuar' }).click();
    await client.waitForTimeout(250);
  }
  await client.getByRole('checkbox').check();
  await client.getByRole('button', { name: 'Enviar solicitação' }).click();
  await client.getByRole('link', { name: 'Ver pedido' }).click();
  await client.waitForURL(/contratacoes\//);
  const path = client.url().replace(/^https?:\/\/[^/]+\/tecti\/2026\/gpec10\//, '');
  await pro.goto(path);
  await settle(pro);
  await pro.getByRole('button', { name: 'Aceitar', exact: true }).click();
  await expect(pro.getByText('Aceito').first()).toBeVisible({ timeout: 15000 });
  await client.reload();
  await settle(client);
  const body = await client.locator('main').innerText();
  expect(body).toMatch(/ainda não|configur|chave Pix|receber|liberando/i);
  await expectNoHorizontalScroll(client);
  await clientCtx.close(); await proCtx.close();
});
