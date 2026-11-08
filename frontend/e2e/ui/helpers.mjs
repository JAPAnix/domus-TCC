import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { e2eDir, API_URL } from '../lib/env.mjs';

export const seed = () => JSON.parse(fs.readFileSync(path.join(e2eDir, '.seed.json'), 'utf8'));
export const PW = 'senha-forte-1';

// Cada conta entra uma vez por rodada: o limite de tentativas de login do sistema (10 por 15 minutos) vale para os testes também.
// O cache fica em arquivo porque o Playwright troca de processo depois de uma falha.
const cacheFile = path.join(e2eDir, '.sessions.json');
const readCache = () => { try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { return {}; } };
export async function apiLogin(email, password = PW) {
  if (password === PW && readCache()[email]) return readCache()[email];
  const response = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const data = await response.json();
  if (!data.token) throw new Error(`login de teste falhou para ${email}: ${JSON.stringify(data)}`);
  if (password === PW) fs.writeFileSync(cacheFile, JSON.stringify({ ...readCache(), [email]: data }));
  return data;
}

/** Abre a sessão no navegador sem passar pela tela de login (o mesmo que o site grava no localStorage). */
export async function signIn(context, email) {
  const { token, user } = await apiLogin(email);
  await context.addInitScript(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user', u); }, [token, JSON.stringify(user)]);
  return { token, user };
}

/**
 * Observa o que um teste de interface não pode deixar passar: erro no console, exceção da página e resposta 5xx da API.
 * Devolve uma função que lança se algo foi visto. `ignore` aceita padrões de mensagens esperadas (ex.: 401 de uma tela pública).
 */
export function watchProblems(page, { ignore = [] } = {}) {
  const problems = [];
  // O botão do Google (GSI) reclama que "localhost" não é uma origem autorizada do cliente: esperado em teste, o login Google não é testado aqui.
  const always = [/GSI_LOGGER/];
  const skip = (text) => [...always, ...ignore].some((pattern) => pattern.test(text));
  page.on('console', (message) => { if (message.type() === 'error' && !skip(message.text())) problems.push(`console: ${message.text().slice(0, 200)}`); });
  page.on('pageerror', (error) => problems.push(`exceção: ${String(error.message).slice(0, 200)}`));
  page.on('response', (response) => { if (response.status() >= 500) problems.push(`HTTP ${response.status()} em ${response.url().replace(/^https?:\/\/[^/]+/, '')}`); });
  return () => expect(problems, problems.join('\n')).toEqual([]);
}

/** A página não pode rolar para os lados (nada vazando da largura da tela). */
export async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'a página rola na horizontal').toBeLessThanOrEqual(1);
}

/** Nenhum texto "quebrado" de programação aparece para o usuário. */
export async function expectCleanText(page) {
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(/\[object Object\]|\bundefined\b|\bNaN\b|\bnull\b(?!\s*[,.)])/);
  return text;
}

export const settle = async (page, ms = 600) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(ms); };
