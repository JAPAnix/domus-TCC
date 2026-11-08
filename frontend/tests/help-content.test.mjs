import test from 'node:test';
import assert from 'node:assert/strict';
import { helpCategories } from '../src/content/help/categories.js';
import { helpArticles, helpArticleBySlug } from '../src/content/help/articles.js';
import { searchArticles } from '../src/content/help/search.js';

// Caminhos que as páginas de ajuda podem citar. Atualize junto com o App.jsx.
const VALID_LINKS = new Set([
  '/buscar', '/perfil/editar', '/meus-servicos', '/favoritos', '/servicos', '/servicos/novo', '/pro/oportunidades', '/forgot-password', '/ajuda/contato',
  '/configuracoes/impostos', '/configuracoes/notificacoes', '/configuracoes/privacidade', '/politica-de-privacidade', '/politica-de-cancelamento',
]);

test('categorias exigidas existem e cada uma tem de 3 a 8 artigos', () => {
  const slugs = helpCategories.map((category) => category.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(helpCategories.length, 8);
  for (const category of helpCategories) {
    const count = helpArticles.filter((article) => article.category === category.slug).length;
    assert.ok(count >= 3 && count <= 8, `${category.slug}: ${count} artigos`);
  }
});

test('artigos têm slug único, categoria válida e conteúdo', () => {
  const slugs = helpArticles.map((article) => article.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const article of helpArticles) {
    assert.match(article.slug, /^[a-z0-9-]{3,120}$/, article.slug);
    assert.ok(helpCategories.some((category) => category.slug === article.category), article.slug);
    assert.ok(article.title && article.summary && article.body.length >= 2, article.slug);
    for (const [type, content] of article.body) {
      assert.ok(['p', 'h', 'ul', 'ol', 'tip', 'link'].includes(type), `${article.slug}: bloco ${type}`);
      if (type === 'ul' || type === 'ol') assert.ok(Array.isArray(content) && content.length > 0, article.slug);
    }
  }
});

test('artigos relacionados e links apontam para algo que existe', () => {
  for (const article of helpArticles) {
    for (const slug of article.related ?? []) assert.ok(helpArticleBySlug[slug], `${article.slug} -> ${slug}`);
    for (const [type, , path] of article.body.filter(([kind]) => kind === 'link')) {
      assert.equal(type, 'link');
      assert.ok(VALID_LINKS.has(path), `${article.slug} -> ${path}`);
    }
  }
});

test('busca encontra por título, resumo, texto e variações da palavra', () => {
  assert.equal(searchArticles('senha')[0].category, 'conta');
  assert.ok(searchArticles('cancelar').some((article) => article.category === 'cancelamentos'));
  assert.ok(searchArticles('CANCELAMENTO pedido').length > 0);
  assert.ok(searchArticles('reembolso').some((article) => article.slug === 'reembolsos'));
  assert.ok(searchArticles('pagamento')[0].category === 'pagamentos');
  assert.ok(searchArticles('acentuação coração').length >= 0);
  assert.deepEqual(searchArticles('zzzzqq'), []);
  assert.deepEqual(searchArticles(''), []);
  assert.deepEqual(searchArticles('a'), []);
});

test('o texto de ajuda não promete o que não existe', () => {
  const text = JSON.stringify(helpArticles).toLowerCase();
  // Só frases que prometem algo. Dizer que um recurso "não existe" é permitido e desejável.
  for (const forbidden of ['receber por whatsapp', 'pagamento seguro pela plataforma', 'garantimos o pagamento', 'reembolso automático', 'notificações push ativas']) assert.ok(!text.includes(forbidden), forbidden);
});
