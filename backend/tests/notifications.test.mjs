import test from 'node:test';
import assert from 'node:assert/strict';
import { markAllRead, markRead, parseIds, unreadCount } from '../src/services/notificationService.js';

// Banco em memória: cada notificação tem dono e readAt, como na tabela de verdade.
function fakeDb(rows) {
  const matches = (row, where) => (where.userId === undefined || row.userId === where.userId)
    && (where.id?.in === undefined || where.id.in.includes(row.id))
    && (where.readAt !== null || row.readAt === null);
  return {
    rows,
    notification: {
      count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
      updateMany: async ({ where, data }) => { const hit = rows.filter((row) => matches(row, where)); hit.forEach((row) => { row.readAt = data.readAt; }); return { count: hit.length }; },
    },
  };
}
const seed = () => fakeDb([
  { id: 1n, userId: 10n, readAt: null }, { id: 2n, userId: 10n, readAt: null }, { id: 3n, userId: 10n, readAt: new Date() },
  { id: 4n, userId: 20n, readAt: null }, { id: 5n, userId: 20n, readAt: null },
]);

test('ids: só números inteiros positivos, sem repetição, de 1 a 100', () => {
  assert.deepEqual(parseIds(['1', 2, '2', '3']), [1n, 2n, 3n]);
  for (const bad of [null, 'x', [], ['a'], ['0'], ['-1'], ['1.5'], [{}], Array.from({ length: 101 }, (_, i) => String(i + 1))]) assert.equal(parseIds(bad), null, JSON.stringify(bad)?.slice(0, 40));
});

test('contador conta só as não lidas do próprio usuário', async () => {
  const db = seed();
  assert.equal(await unreadCount(db, 10n), 2);
  assert.equal(await unreadCount(db, 20n), 2);
  assert.equal(await unreadCount(db, 99n), 0);
});

test('marcar como lida atualiza o banco e o contador cai (e zera ao marcar tudo)', async () => {
  const db = seed();
  assert.equal(await markRead(db, 10n, [1n]), 1);
  assert.notEqual(db.rows[0].readAt, null);
  assert.equal(await markRead(db, 10n, [2n]), 0);
});

test('marcar de novo é inofensivo e não muda a data da leitura', async () => {
  const db = seed();
  await markRead(db, 10n, [1n]);
  const first = db.rows[0].readAt;
  await markRead(db, 10n, [1n]);
  assert.equal(db.rows[0].readAt, first);
});

test('o usuário A não consegue marcar notificações do usuário B', async () => {
  const db = seed();
  const left = await markRead(db, 10n, [4n, 5n]);
  assert.equal(left, 2, 'as notificações de A continuam não lidas');
  assert.equal(db.rows[3].readAt, null);
  assert.equal(db.rows[4].readAt, null);
  assert.equal(await unreadCount(db, 20n), 2);
});

test('marcar todas zera só as do usuário', async () => {
  const db = seed();
  assert.equal(await markAllRead(db, 10n), 0);
  assert.equal(await unreadCount(db, 10n), 0);
  assert.equal(await unreadCount(db, 20n), 2);
});

test('notificação nova depois de zerar faz o contador reaparecer', async () => {
  const db = seed();
  await markAllRead(db, 10n);
  db.rows.push({ id: 6n, userId: 10n, readAt: null });
  assert.equal(await unreadCount(db, 10n), 1);
});
