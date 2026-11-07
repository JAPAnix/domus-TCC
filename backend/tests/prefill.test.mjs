import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrefill } from '../src/controllers/prefillController.js';

const user = (extra = {}) => ({
  firstName: 'Maria', lastName: 'Silva', email: 'maria@exemplo.com', phoneNumber: '+5541999998888', birthDate: new Date('1990-01-05T00:00:00.000Z'),
  zipCode: '80010-000', street: 'Rua das Flores', number: '123', complement: null, neighborhood: 'Centro', city: 'Curitiba', state: 'PR',
  settings: { taxDocument: '529.982.247-25', taxHolderName: 'Maria da Silva' }, ...extra,
});

test('dados já informados: nome, telefone, nascimento, endereço e CPF válido', () => {
  const data = buildPrefill(user());
  assert.equal(data.name, 'Maria Silva');
  assert.equal(data.phone, '5541999998888');
  assert.equal(data.birthDate, '1990-01-05');
  assert.equal(data.document, '52998224725');
  assert.equal(data.documentType, 'cpf');
  assert.equal(data.holderName, 'Maria da Silva');
  assert.deepEqual(data.address, { postal_code: '80010000', street: 'Rua das Flores', number: '123', complement: '', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' });
});

test('documento inválido ou ausente não é devolvido', () => {
  assert.equal(buildPrefill(user({ settings: { taxDocument: '111.111.111-11', taxHolderName: null } })).document, null);
  assert.equal(buildPrefill(user({ settings: null })).document, null);
  assert.equal(buildPrefill(user({ settings: { taxDocument: '11.222.333/0001-81', taxHolderName: 'Empresa' } })).documentType, 'cnpj');
});

test('conta nova: tudo vazio, sem quebrar', () => {
  const data = buildPrefill(user({ phoneNumber: null, birthDate: null, zipCode: null, street: null, number: null, neighborhood: null, city: null, state: null, settings: null }));
  assert.equal(data.phone, '');
  assert.equal(data.birthDate, null);
  assert.deepEqual(data.address, { postal_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' });
});
