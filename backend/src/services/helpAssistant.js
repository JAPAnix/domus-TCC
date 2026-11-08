import { prisma } from '../config/prisma.js';
import { uuidToBuffer, bufferToUuid, generateUuid } from '../utils/uuid.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LENGTH = 200;

/**
 * Tira da pergunta o que identifica uma pessoa antes de gravar: e-mails, endereços de site, CPF/CNPJ, telefones e
 * qualquer sequência longa de números (cartão, conta). O texto que sobra é o que o administrador lê.
 */
export function scrubQuestion(text) {
  return String(text ?? '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[removido]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[removido]')
    .replace(/(?:\d[\s.\-()/]*){8,}/g, '[removido]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}

/** Agrupa perguntas parecidas (sem acento, maiúscula ou pontuação) para o painel mostrar quantas vezes cada uma apareceu. */
export const groupKey = (question) => question.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export async function logQuestion({ question, slug, answered }, db = prisma) {
  const clean = scrubQuestion(question);
  if (clean.length < 2) return { uuid: null };
  const uuid = generateUuid();
  await db.helpAssistantQuestion.create({ data: { uuid, question: clean, articleSlug: answered ? slug ?? null : null, answered: !!answered } });
  return { uuid: bufferToUuid(uuid) };
}

export async function rateAnswer(uuid, helpful, db = prisma) {
  if (!UUID.test(uuid)) return false;
  // Só a primeira avaliação vale: quem tem o código da pergunta não consegue trocar a resposta depois.
  const result = await db.helpAssistantQuestion.updateMany({ where: { uuid: uuidToBuffer(uuid), helpful: null }, data: { helpful } });
  return result.count > 0;
}

/** Números para o administrador: o que as pessoas perguntaram e não tinha artigo, e como cada artigo foi avaliado. */
export async function assistantReport({ days = 30 } = {}, db = prisma) {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await db.helpAssistantQuestion.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 5000, select: { question: true, articleSlug: true, answered: true, helpful: true, createdAt: true } });
  const unanswered = new Map();
  const articles = new Map();
  let helpful = 0, notHelpful = 0;
  for (const row of rows) {
    if (!row.answered) {
      const key = groupKey(row.question);
      const entry = unanswered.get(key) ?? { question: row.question, count: 0, lastAt: row.createdAt };
      entry.count += 1;
      unanswered.set(key, entry);
    } else if (row.articleSlug) {
      const entry = articles.get(row.articleSlug) ?? { slug: row.articleSlug, asked: 0, helpful: 0, notHelpful: 0 };
      entry.asked += 1;
      if (row.helpful === true) entry.helpful += 1;
      if (row.helpful === false) entry.notHelpful += 1;
      articles.set(row.articleSlug, entry);
    }
    if (row.helpful === true) helpful += 1;
    if (row.helpful === false) notHelpful += 1;
  }
  const answeredCount = rows.filter((row) => row.answered).length;
  return {
    days, total: rows.length, answered: answeredCount, unansweredTotal: rows.length - answeredCount, helpful, notHelpful,
    unanswered: [...unanswered.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt).slice(0, 100),
    articles: [...articles.values()].sort((a, b) => b.notHelpful - a.notHelpful || b.asked - a.asked).slice(0, 50),
  };
}
