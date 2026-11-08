import { helpArticles, helpArticleBySlug } from './articles.js';
import { helpCategories } from './categories.js';

/*
 * Motor do assistente de ajuda. Responde SOMENTE com artigos da Central de Ajuda: se nada combina com confiança,
 * devolve { kind: 'none' } e o assistente diz que não sabe. Nada aqui inventa texto.
 *
 * Para trocar a busca por uma IA no futuro, basta criar outro objeto com a mesma forma de `assistantEngine`
 * (`answer(question)` devolvendo uma Promise do mesmo resultado, escolhendo entre os mesmos artigos) e apontar
 * `assistantEngine` para ele. A tela não muda.
 */

const STOP = new Set(('a o as os um uma uns umas de do da dos das em no na nos nas por para pra com sem sobre e ou mas que qual quais como quando onde porque por que ' +
  'eu me meu minha meus minhas voce vc seu sua seus suas nao sim ja ate ao aos se so mais muito muita tambem ser sao esta estao tem ter tenho quero preciso queria gostaria ' +
  'posso pode podem fazer faco faz favor ajuda ajudar duvida app site oi ola bom dia tarde noite obrigado obrigada').split(' '));

// Palavras do dia a dia que apontam para os termos usados nos artigos.
const SYNONYMS = {
  estorno: ['reembolso'], devolver: ['reembolso'], devolucao: ['reembolso'], ressarcimento: ['reembolso'], dinheiro: ['pagamento', 'reembolso'], volta: ['reembolso'],
  pagar: ['pagamento'], paguei: ['pagamento'], cobranca: ['pagamento'], cobrar: ['pagamento'], pix: ['pagamento'], cartao: ['pagamento'], boleto: ['pagamento'],
  receber: ['recebimento', 'pagamento'], recebo: ['recebimento', 'pagamento'], repasse: ['recebimento'], saque: ['recebimento'],
  trabalhar: ['profissional'], anunciar: ['anuncio', 'profissional'], vender: ['profissional'], oferecer: ['profissional'],
  contratar: ['solicitar'], pedir: ['solicitar'], pedido: ['solicitar'], comprar: ['solicitar'],
  apagar: ['excluir'], deletar: ['excluir'], remover: ['excluir'], encerrar: ['excluir'],
  logar: ['entrar'], login: ['entrar'], acessar: ['entrar'], senha: ['senha'], password: ['senha'],
  taxa: ['taxas'], comissao: ['taxas'], imposto: ['impostos'], nota: ['avaliar'], avaliacao: ['avaliar'], estrelas: ['avaliar'],
  golpe: ['seguranca'], fraude: ['seguranca'], seguro: ['seguranca'], denuncia: ['denunciar'], bloquear: ['bloquear'],
  mensagem: ['mensagens'], conversa: ['mensagens'], chat: ['mensagens'], aviso: ['notificacoes'], notificacao: ['notificacoes'],
};

export const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Tira plural e as duas últimas letras de palavras longas, para "cancelar" achar "cancelamento". */
function stem(word) {
  let w = word;
  if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1);
  return w.length >= 6 ? w.slice(0, -2) : w;
}

export function tokens(text) {
  return normalize(text).split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !STOP.has(word));
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** Quão bem uma palavra digitada combina com uma palavra do artigo: igual, começo igual ou erro de digitação. */
function similarity(query, word) {
  if (query === word) return 1;
  const shorter = Math.min(query.length, word.length);
  if (shorter >= 4 && (word.startsWith(query) || query.startsWith(word))) return 0.85;
  if (shorter >= 4) {
    const allowed = shorter >= 8 ? 2 : 1;
    if (distance(query, word) <= allowed) return 0.7;
  }
  return 0;
}

function plainBody(article) {
  return article.body.flatMap(([type, content]) => (type === 'ul' || type === 'ol' ? content : type === 'link' ? [] : [content])).join(' ');
}

const unique = (list) => [...new Set(list)];
const stems = (text) => unique(tokens(text).map(stem));

function buildIndex(articles) {
  const docs = articles.map((article) => ({ article, title: stems(article.title), summary: stems(article.summary), body: stems(plainBody(article)) }));
  const frequency = new Map();
  for (const doc of docs) for (const word of new Set([...doc.title, ...doc.summary, ...doc.body])) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  return { docs, frequency, total: docs.length };
}

const bestMatch = (variants, words) => {
  let best = 0;
  for (const variant of variants) for (const word of words) best = Math.max(best, similarity(variant, word));
  return best;
};

const WEIGHTS = { title: 5, summary: 3, body: 1 };
/** Cobertura mínima de palavras da pergunta e nota mínima para considerar uma resposta confiável. */
const MIN_COVERAGE = 0.6;
const MIN_SCORE = 3;

/**
 * Procura a melhor resposta entre os artigos. Devolve { kind: 'answer', article, related } ou { kind: 'none', category }.
 * `category` é só uma pista (a categoria mais próxima) para encaminhar a pessoa ao suporte.
 */
export function findAnswer(question, articles = helpArticles, index = buildIndex(articles)) {
  const original = tokens(question);
  // Palavras que aparecem em quase todos os artigos não ajudam a distinguir nada.
  const meaningful = original.filter((word) => (index.frequency.get(stem(word)) ?? 0) / index.total <= 0.5 || index.total < 6);
  if (!meaningful.length) return { kind: 'none', category: null };

  const queries = meaningful.map((word) => ({ variants: unique([stem(word), ...(SYNONYMS[word] ?? []).map(stem)]), idf: Math.log(1 + index.total / Math.max(1, index.frequency.get(stem(word)) ?? 1)) }));
  const scored = index.docs.map((doc) => {
    let score = 0, matched = 0, strong = 0;
    for (const query of queries) {
      const title = bestMatch(query.variants, doc.title), summary = bestMatch(query.variants, doc.summary), body = bestMatch(query.variants, doc.body);
      const best = Math.max(title * WEIGHTS.title, summary * WEIGHTS.summary, body * WEIGHTS.body);
      if (best <= 0) continue;
      matched += 1;
      if (title > 0 || summary > 0) strong += 1;
      score += best * query.idf;
    }
    return { article: doc.article, score, coverage: matched / queries.length, strong };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const confident = top && top.coverage >= MIN_COVERAGE && top.strong >= 1 && top.score >= MIN_SCORE;
  if (!confident) return { kind: 'none', category: top ? top.article.category : null };

  const related = [];
  for (const slug of top.article.related ?? []) if (helpArticleBySlug[slug] && related.length < 2) related.push(helpArticleBySlug[slug]);
  for (const entry of scored.slice(1)) {
    if (related.length >= 2) break;
    if (entry.coverage >= MIN_COVERAGE && entry.score >= top.score * 0.4 && !related.some((article) => article.slug === entry.article.slug)) related.push(entry.article);
  }
  return { kind: 'answer', article: top.article, related: related.slice(0, 2) };
}

/** Perguntas rápidas da mensagem inicial. Cada uma aponta direto para um artigo existente. */
export const quickQuestions = [
  { label: 'Como contratar um serviço', slug: 'solicitar-um-servico' },
  { label: 'Como pagar', slug: 'como-funciona-o-pagamento' },
  { label: 'Cancelamento e reembolso', slug: 'reembolsos' },
  { label: 'Quero ser profissional', slug: 'comecar-a-oferecer-servicos' },
  { label: 'Como receber pagamento', slug: 'impostos-e-recebimento' },
  { label: 'Conta e segurança', slug: 'alterar-ou-criar-senha' },
].filter((item) => helpArticleBySlug[item.slug]);

/** Endereço do formulário do suporte, já com a pergunta e o assunto mais próximo. */
export function supportLink(question, category) {
  const params = new URLSearchParams();
  if (category) params.set('assunto', category);
  if (question) params.set('mensagem', question.slice(0, 500));
  return `/ajuda/contato?${params.toString()}`;
}

export const categoryTitle = (slug) => helpCategories.find((category) => category.slug === slug)?.title ?? null;

const index = buildIndex(helpArticles);

/** Ponto único de troca: hoje busca por palavras nos artigos; no futuro pode ser uma IA que use os mesmos artigos. */
export const assistantEngine = {
  name: 'keywords',
  async answer(question) { return findAnswer(question, helpArticles, index); },
  /** Resposta direta a uma pergunta rápida (artigo já escolhido). */
  quick(slug) { const article = helpArticleBySlug[slug]; return article ? { kind: 'answer', article, related: (article.related ?? []).map((item) => helpArticleBySlug[item]).filter(Boolean).slice(0, 2) } : { kind: 'none', category: null }; },
};
