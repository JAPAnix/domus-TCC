// D. Pedido aberto, pela interface: o cliente publica (passo a passo), o profissional compatível vê em Oportunidades e propõe,
// o cliente compara e aceita (nasce o pedido interno com origem "pedido aberto"), e a moderação remove um pedido denunciado.
import { test, expect } from '@playwright/test';
import { seed, signIn, apiLogin, watchProblems, expectNoHorizontalScroll, settle } from './helpers.mjs';
import { API_URL } from '../lib/env.mjs';

const data = seed();
const api = async (method, route, body, token) => {
  const response = await fetch(API_URL + route, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => null) };
};
const EXPECTED = [/status of 401/i, /Failed to load resource.*(401|403|409)/i];

test('cliente publica um pedido aberto pelo passo a passo, e o profissional compatível vê, propõe e o cliente aceita', async ({ browser }, info) => {
  // Só letras no marcador: uma sequência longa de números num título é (corretamente) escondida como se fosse telefone.
  const tag = `v${info.project.name}x${Math.random().toString(36).replace(/[0-9]/g, '').slice(0, 6)}`;
  const title = `TESTE-Pintura de apartamento ${tag}`;
  const categories = (await api('GET', '/categories')).data;

  // ---------- cliente publica ----------
  const clientCtx = await browser.newContext();
  await signIn(clientCtx, data.clients[1].email);
  const client = await clientCtx.newPage();
  const verifyClient = watchProblems(client, { ignore: EXPECTED });
  await client.goto('buscar');
  await settle(client);
  await expect(client.getByText('Não encontrou o que precisa?')).toBeVisible();
  await client.getByRole('link', { name: 'Publicar um pedido' }).first().click();
  await expect(client.getByText('Etapa 1 de 8')).toBeVisible();
  await client.getByRole('button', { name: 'Continuar' }).click();
  await expect(client.getByText('Escolha uma categoria.')).toBeVisible();
  await client.getByLabel('Categoria').selectOption(String(categories[0].id));
  await client.getByLabel('Título do pedido').fill(title);
  await client.getByRole('button', { name: 'Continuar' }).click();
  await client.getByLabel('Descreva o que precisa ser feito').fill('Pintar sala curta');
  await client.getByRole('button', { name: 'Continuar' }).click();
  await expect(client.getByText(/pelo menos 30 caracteres/)).toBeVisible();
  await client.getByLabel('Descreva o que precisa ser feito').fill('Preciso pintar uma sala de 20 m² e um quarto, duas demãos. Me chame no zap 41 99999-1234.');
  await expect(client.getByText('serão removidos do texto')).toBeVisible();
  await client.getByRole('button', { name: 'Continuar' }).click();   // fotos
  await client.getByRole('button', { name: 'Continuar' }).click();   // local
  await client.getByLabel('Cidade').fill('Curitiba');
  await client.getByLabel('Estado').selectOption('PR');
  await client.getByRole('button', { name: 'Continuar' }).click();   // orçamento
  await client.getByRole('button', { name: 'Continuar' }).click();   // preferências
  await client.getByRole('button', { name: 'Continuar' }).click();   // validade
  await expect(client.getByLabel('Receber propostas por')).toHaveValue('7');
  await expect(client.getByText(/até 5 propostas/)).toBeVisible();
  await client.getByRole('button', { name: 'Continuar' }).click();   // revisão
  await expect(client.getByText('É assim que os profissionais vão ver o seu pedido')).toBeVisible();
  await expect(client.getByText('[contato removido]')).toBeVisible();
  await expect(client.getByText('99999')).toHaveCount(0);
  await expectNoHorizontalScroll(client);
  await client.getByRole('button', { name: 'Publicar pedido' }).click();
  await expect(client.getByRole('heading', { name: title })).toBeVisible();
  await expect(client.getByText(/Recebe propostas por mais/)).toBeVisible();
  const serviceUuid = client.url().split('/').pop();

  // ---------- profissional A vê em Oportunidades e propõe ----------
  const proCtx = await browser.newContext();
  await signIn(proCtx, data.pros.a.email);
  const pro = await proCtx.newPage();
  const verifyPro = watchProblems(pro, { ignore: EXPECTED });
  await pro.goto('pro/oportunidades');
  await settle(pro);
  await expect(pro.getByText(title)).toBeVisible();
  await expect(pro.getByText('Nova').first()).toBeVisible();
  await pro.getByText(title).first().click();
  await expect(pro.getByText('Quem pediu')).toBeVisible();
  await expect(pro.getByText('O endereço completo só aparece depois')).toBeVisible();
  await pro.getByRole('link', { name: 'Enviar proposta' }).click();
  await pro.getByLabel('Valor proposto (R$)').fill('900');
  await expect(pro.getByText(/Você recebe/)).toBeVisible();
  await pro.getByLabel('Prazo de entrega (dias)').fill('3');
  await pro.getByLabel('O que está incluso').fill('Material e mão de obra');
  await pro.getByRole('button', { name: 'Enviar proposta' }).click();
  await pro.waitForURL(/pro\/oportunidades$/);
  await pro.goto(`pro/oportunidades/${serviceUuid}`);
  await expect(pro.getByText('Sua proposta está pendente')).toBeVisible();
  await pro.getByRole('link', { name: 'Editar a minha proposta' }).click();
  await expect(pro.getByLabel('Valor proposto (R$)')).toHaveValue('900');
  await pro.getByLabel('Valor proposto (R$)').fill('850');
  await pro.getByRole('button', { name: 'Salvar alterações' }).click();
  await pro.waitForURL(/pro\/oportunidades$/);

  // ---------- profissional B (incompleto, mas pode propor): proposta pela API para ter o que comparar ----------
  const proB = await apiLogin(data.pros.b.email);
  const second = await api('POST', `/services/${serviceUuid}/proposals`, { proposed_price: 700, delivery_time_days: 5, included: 'Só mão de obra', valid_hours: 48 }, proB.token);
  expect(second.status).toBe(201);

  // ---------- cliente compara e aceita ----------
  await client.goto('meus-servicos?aba=pedidos');
  await settle(client);
  await client.getByRole('tab', { name: /Com propostas/ }).click();
  await expect(client.getByText(title)).toBeVisible();
  await client.getByRole('link', { name: 'Comparar propostas' }).first().click();
  await expect(client.getByRole('table')).toBeVisible();
  await expect(client.getByText('Menor valor')).toBeVisible();
  await expect(client.getByText('Só mão de obra').first()).toBeVisible();
  await expectNoHorizontalScroll(client);
  await client.getByRole('table').getByRole('button', { name: 'Aceitar' }).first().click();
  await client.getByRole('dialog').getByRole('button', { name: /Aceitar proposta/ }).click();
  await client.waitForURL(/contratacoes\//);
  await settle(client, 1500);
  await expect(client.getByText('Pedido aberto', { exact: true }).first()).toBeVisible();
  await expect(client.getByText('R$ 700,00').first()).toBeVisible();

  verifyClient(); verifyPro();
  await clientCtx.close(); await proCtx.close();
});

test('denúncia: o profissional denuncia um pedido, o administrador remove com justificativa e o pedido some', async ({ browser }, info) => {
  // Só letras no marcador: uma sequência longa de números num título é (corretamente) escondida como se fosse telefone.
  const tag = `v${info.project.name}x${Math.random().toString(36).replace(/[0-9]/g, '').slice(0, 6)}`;
  const title = `TESTE-Pedido suspeito ${tag}`;
  const categories = (await api('GET', '/categories')).data;
  const owner = await apiLogin(data.clients[2].email);
  const created = await api('POST', '/services', { title, description: 'Ligue para mim e fechamos por fora da plataforma sem pagar taxa nenhuma.', category_id: categories[0].id, city: 'Curitiba', state: 'PR' }, owner.token);
  expect(created.status).toBe(201);

  const proCtx = await browser.newContext();
  await signIn(proCtx, data.pros.a.email);
  const pro = await proCtx.newPage();
  await pro.goto(`pro/oportunidades/${created.data.uuid}`);
  await settle(pro);
  await pro.getByRole('button', { name: 'Denunciar este pedido' }).click();
  await pro.getByRole('dialog').getByLabel('Motivo').selectOption('contact');
  await pro.getByRole('dialog').getByRole('button', { name: 'Enviar denúncia' }).click();
  await expect(pro.getByText('Denúncia enviada')).toBeVisible();

  const adminCtx = await browser.newContext();
  await signIn(adminCtx, data.admin.email);
  const admin = await adminCtx.newPage();
  const verify = watchProblems(admin, { ignore: EXPECTED });
  await admin.goto('admin/moderacao');
  await settle(admin);
  await expect(admin.getByText(title)).toBeVisible();
  await expect(admin.getByText('O que é:')).toBeVisible();
  await expectNoHorizontalScroll(admin);
  await admin.locator('article', { hasText: title }).getByRole('button', { name: 'Remover pedido' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Remover', exact: true }).click();
  await expect(admin.getByText('Escreva uma justificativa')).toBeVisible();
  await admin.getByRole('dialog').getByLabel('Justificativa').fill('Tenta fechar por fora da plataforma.');
  await admin.getByRole('dialog').getByRole('button', { name: 'Remover', exact: true }).click();
  await expect(admin.getByText(title)).toHaveCount(0);
  const gone = await api('GET', `/services/${created.data.uuid}`);
  expect(gone.status).toBe(404);
  verify();
  await proCtx.close(); await adminCtx.close();
});
