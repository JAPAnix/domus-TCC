import { helpArticles } from './articles.js';

const normalize = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "cancelar" também deve achar "cancelamento": termos longos perdem as duas últimas letras na comparação.
const stem = (term) => (term.length >= 6 ? term.slice(0, -2) : term);

function plainBody(article) {
  return article.body.flatMap(([type, content]) => {
    if (type === 'ul' || type === 'ol') return content;
    if (type === 'link') return [];
    return [content];
  }).join(' ');
}

/** Busca nos títulos, resumos e textos. Todos os termos digitados precisam aparecer em algum lugar do artigo. */
export function searchArticles(query, articles = helpArticles) {
  const terms = normalize(query).split(/\s+/).filter((term) => term.length > 1).map(stem);
  if (!terms.length) return [];
  return articles
    .map((article) => {
      const title = normalize(article.title);
      const summary = normalize(article.summary);
      const body = normalize(plainBody(article));
      if (!terms.every((term) => title.includes(term) || summary.includes(term) || body.includes(term))) return { article, score: 0 };
      const score = terms.reduce((total, term) => total + (title.includes(term) ? 5 : 0) + (summary.includes(term) ? 3 : 0) + (body.includes(term) ? 1 : 0), 0);
      return { article, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.article);
}
