import test from 'node:test';
import assert from 'node:assert/strict';
import { findAnswer, quickQuestions } from '../src/content/help/assistant.js';
import { helpArticles, helpArticleBySlug } from '../src/content/help/articles.js';

const slugOf = (question) => { const result = findAnswer(question); return result.kind === 'answer' ? result.article.slug : null; };

test('acha o artigo certo para perguntas comuns', () => {
  const cases = [
    ['como faço para cancelar um pedido?', 'cancelar-um-pedido-ou-contratacao'],
    ['esqueci minha senha', 'esqueci-minha-senha'],
    ['quero meu dinheiro de volta', 'reembolsos'],
    ['como recebo o pagamento dos meus serviços', null],
    ['como bloquear uma pessoa', 'bloquear-uma-pessoa'],
    ['como excluir minha conta', 'desativar-ou-excluir-conta'],
    ['entrar com google', 'login-com-google'],
  ];
  for (const [question, expected] of cases) {
    const got = slugOf(question);
    if (expected) assert.equal(got, expected, question);
    else assert.ok(got, question);
  }
});

test('tolera acento, maiúscula e erro de digitação', () => {
  assert.equal(slugOf('ESQUECI MINHA SENHÁ'), 'esqueci-minha-senha');
  assert.equal(slugOf('esquesi minha snha'), 'esqueci-minha-senha');
  assert.equal(slugOf('reenbolso'), 'reembolsos');
  assert.equal(slugOf('bloquiar pessoa'), 'bloquear-uma-pessoa');
  assert.equal(slugOf('cancelamneto de pedido'), 'cancelar-um-pedido-ou-contratacao');
});

test('nunca inventa: assunto fora da Central devolve "none"', () => {
  for (const question of ['qual a capital da frança', 'receita de bolo de cenoura', 'asdkjh qwezx', 'quanto custa um iphone', 'previsão do tempo amanhã', '???', '', 'a o de']) {
    assert.equal(findAnswer(question).kind, 'none', question);
  }
});

test('resposta traz o melhor artigo e até 2 relacionados, sem repetir', () => {
  for (const question of ['esqueci minha senha', 'como cancelar', 'taxas da plataforma', 'verificação do profissional']) {
    const result = findAnswer(question);
    assert.equal(result.kind, 'answer', question);
    assert.ok(result.related.length <= 2);
    assert.ok(result.related.every((article) => article.slug !== result.article.slug));
    assert.equal(new Set(result.related.map((article) => article.slug)).size, result.related.length);
  }
});

test('todo artigo é encontrado pelo próprio título', () => {
  const misses = helpArticles.filter((article) => slugOf(article.title) !== article.slug).map((article) => `${article.slug} -> ${slugOf(article.title)}`);
  assert.deepEqual(misses, []);
});

test('perguntas rápidas: de 5 a 6, todas apontam para artigos existentes', () => {
  assert.ok(quickQuestions.length >= 5 && quickQuestions.length <= 6);
  for (const item of quickQuestions) assert.ok(helpArticleBySlug[item.slug], item.slug);
});
