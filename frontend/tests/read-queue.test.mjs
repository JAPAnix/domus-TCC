import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadQueue } from '../src/utils/readQueue.js';

const net = () => Object.assign(new Error('rede'), {}); // sem resposta: falha de rede
const http = (status) => Object.assign(new Error('http'), { response: { status } });

function setup(posts) {
  const calls = [], unread = [], waits = [];
  const queue = createReadQueue({
    post: async (ids) => { calls.push(ids); const next = posts.shift(); if (next instanceof Error) throw next; return next; },
    onUnread: (n) => unread.push(n),
    wait: (ms, fn) => waits.push(fn),
  });
  return { queue, calls, unread, waits };
}

test('marca como lida e avisa o contador com o número que restou', async () => {
  const { queue, calls, unread } = setup([0]);
  await queue.enqueue([1, '2']);
  assert.deepEqual(calls, [['1', '2']]);
  assert.deepEqual(unread, [0]);
  assert.equal(queue.size, 0);
});

test('falha de rede: guarda e tenta de novo depois, sem perder nada', async () => {
  const { queue, calls, unread, waits } = setup([net(), 3]);
  await queue.enqueue([7]);
  assert.equal(queue.size, 1);
  assert.equal(unread.length, 0);
  assert.equal(waits.length, 1);
  await waits[0]();
  assert.equal(queue.size, 0);
  assert.deepEqual(calls, [['7'], ['7']]);
  assert.deepEqual(unread, [3]);
});

test('erro do servidor (500) também tenta de novo; muitas tentativas (429) também', async () => {
  const { queue, waits } = setup([http(500), http(429), 0]);
  await queue.enqueue([1]);
  assert.equal(waits.length, 1);
  await waits[0]();
  assert.equal(waits.length, 2);
  await waits[1]();
  assert.equal(queue.size, 0);
});

test('erro do pedido (400/404) descarta: repetir não adianta', async () => {
  const { queue, waits } = setup([http(400)]);
  await queue.enqueue([1]);
  assert.equal(queue.size, 0);
  assert.equal(waits.length, 0);
});

test('mais de 100 ids saem em lotes de 100', async () => {
  const ids = Array.from({ length: 230 }, (_, i) => i + 1);
  const { queue, calls } = setup([130, 30, 0]);
  await queue.enqueue(ids);
  assert.deepEqual(calls.map((batch) => batch.length), [100, 100, 30]);
  assert.equal(queue.size, 0);
});

test('o mesmo id enfileirado duas vezes vai uma vez só', async () => {
  const { queue, calls } = setup([0]);
  await queue.enqueue([5, 5, '5']);
  assert.deepEqual(calls, [['5']]);
});
