import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubQuestion, groupKey, logQuestion, rateAnswer, assistantReport } from '../src/services/helpAssistant.js';
import { assistantQuestionSchema, assistantRatingSchema } from '../src/validators/areaValidator.js';

function fakeDb(seed = []) {
  const rows = seed.map((row, index) => ({ id: index + 1, uuid: Buffer.alloc(16, index + 1), helpful: null, createdAt: new Date(), articleSlug: null, ...row }));
  return {
    rows,
    helpAssistantQuestion: {
      create: async ({ data }) => { rows.push({ id: rows.length + 1, helpful: null, createdAt: new Date(), ...data }); return data; },
      updateMany: async ({ where, data }) => {
        const hits = rows.filter((row) => Buffer.compare(row.uuid, where.uuid) === 0 && row.helpful === where.helpful);
        hits.forEach((row) => Object.assign(row, data));
        return { count: hits.length };
      },
      findMany: async ({ where }) => rows.filter((row) => row.createdAt >= where.createdAt.gte),
    },
  };
}

test('scrubQuestion remove e-mail, telefone, CPF, cartão e links', () => {
  const dirty = 'Meu email é ana.silva@exemplo.com.br e o cel (41) 99999-1234, cpf 529.982.247-25, cartão 4111 1111 1111 1111, veja https://x.com/a?id=1 e www.site.com';
  const clean = scrubQuestion(dirty);
  for (const secret of ['ana.silva', '99999', '529.982', '4111', 'x.com', 'www.']) assert.ok(!clean.includes(secret), `${secret} -> ${clean}`);
  assert.ok(clean.includes('[removido]'));
});

test('scrubQuestion mantém a pergunta e limita o tamanho', () => {
  assert.equal(scrubQuestion('  Como   cancelar   um pedido? '), 'Como cancelar um pedido?');
  assert.equal(scrubQuestion('a'.repeat(500)).length, 200);
  assert.equal(scrubQuestion('Pedido 12 e 3 dias'), 'Pedido 12 e 3 dias');
});

test('groupKey junta perguntas iguais sem acento, maiúscula ou pontuação', () => {
  assert.equal(groupKey('Como CANCELAR o pedido?'), groupKey('como cancelar o pedido'));
  assert.notEqual(groupKey('como cancelar'), groupKey('como pagar'));
});

test('logQuestion grava texto limpo, sem usuário, e só guarda o artigo se houve resposta', async () => {
  const db = fakeDb();
  const first = await logQuestion({ question: 'Meu email joao@x.com não chega', slug: 'esqueci-minha-senha', answered: true }, db);
  assert.match(first.uuid, /^[0-9a-f-]{36}$/);
  await logQuestion({ question: 'algo que não existe', slug: 'esqueci-minha-senha', answered: false }, db);
  assert.equal(db.rows[0].question.includes('joao'), false);
  assert.equal(db.rows[0].articleSlug, 'esqueci-minha-senha');
  assert.equal(db.rows[1].articleSlug, null);
  assert.deepEqual(Object.keys(db.rows[0]).filter((key) => /user|ip|email/i.test(key)), []);
  assert.deepEqual(await logQuestion({ question: ' ', answered: false }, db), { uuid: null });
});

test('rateAnswer: só a primeira avaliação vale e código inválido é ignorado', async () => {
  const db = fakeDb();
  const { uuid } = await logQuestion({ question: 'como pagar', slug: 'como-funciona-o-pagamento', answered: true }, db);
  assert.equal(await rateAnswer('lixo', true, db), false);
  assert.equal(await rateAnswer(uuid, true, db), true);
  assert.equal(await rateAnswer(uuid, false, db), false);
  assert.equal(db.rows[0].helpful, true);
});

test('assistantReport: perguntas sem resposta agrupadas e artigos por avaliação', async () => {
  const mk = (extra) => ({ question: 'x', answered: true, articleSlug: null, helpful: null, createdAt: new Date(), ...extra });
  const db = fakeDb([
    mk({ question: 'Como emitir nota fiscal?', answered: false }), mk({ question: 'como emitir NOTA fiscal', answered: false }), mk({ question: 'tem app de celular?', answered: false }),
    mk({ articleSlug: 'reembolsos', helpful: false }), mk({ articleSlug: 'reembolsos', helpful: true }), mk({ articleSlug: 'esqueci-minha-senha', helpful: true }),
    mk({ question: 'antiga', answered: false, createdAt: new Date(Date.now() - 400 * 86400000) }),
  ]);
  const report = await assistantReport({ days: 30 }, db);
  assert.equal(report.total, 6);
  assert.equal(report.unansweredTotal, 3);
  assert.equal(report.unanswered[0].count, 2);
  assert.equal(report.articles[0].slug, 'reembolsos');
  assert.deepEqual([report.helpful, report.notHelpful], [2, 1]);
});

test('validadores: pergunta curta, slug inválido e voto sem boolean são recusados', () => {
  assert.ok(assistantQuestionSchema.safeParse({ question: 'como pagar', slug: 'como-funciona-o-pagamento', answered: true }).success);
  assert.ok(assistantQuestionSchema.safeParse({ question: 'x', answered: true }).success === false);
  assert.ok(assistantQuestionSchema.safeParse({ question: 'como pagar', slug: 'Drop Table', answered: true }).success === false);
  assert.ok(assistantQuestionSchema.safeParse({ question: 'como pagar' }).success === false);
  assert.ok(assistantRatingSchema.safeParse({ helpful: 'sim' }).success === false);
});
