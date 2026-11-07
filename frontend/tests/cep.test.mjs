import test from 'node:test';
import assert from 'node:assert/strict';
import { digitsOf, lookupCep, maskCep } from '../src/utils/cep.js';

const realFetch = globalThis.fetch;
const reply = (body, ok = true) => { globalThis.fetch = async () => ({ ok, json: async () => body }); };
test.afterEach(() => { globalThis.fetch = realFetch; });

test('CEP: dígitos e máscara', () => {
  assert.equal(digitsOf('80010-000'), '80010000');
  assert.equal(maskCep('80010000'), '80010-000');
  assert.equal(maskCep('80010-000999'), '80010-000');
  assert.equal(maskCep('800'), '800');
});

test('CEP: não consulta enquanto não tem 8 dígitos', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: true, json: async () => ({}) }; };
  assert.equal(await lookupCep('8001'), null);
  assert.equal(calls, 0);
});

test('CEP: devolve rua, bairro, cidade e estado', async () => {
  reply({ logradouro: ' Rua das Flores ', bairro: 'Centro', localidade: 'Curitiba', uf: 'PR' });
  assert.deepEqual(await lookupCep('80010-000'), { street: 'Rua das Flores', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' });
});

test('CEP: não encontrado devolve null; resposta ruim ou falha de rede lançam erro', async () => {
  reply({ erro: true });
  assert.equal(await lookupCep('00000000'), null);
  reply({ localidade: 'Curitiba', uf: 'Paraná' });
  await assert.rejects(lookupCep('80010000'));
  reply({}, false);
  await assert.rejects(lookupCep('80010000'));
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(lookupCep('80010000'));
});
