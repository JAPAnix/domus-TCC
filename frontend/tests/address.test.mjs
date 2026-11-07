import test from 'node:test';
import assert from 'node:assert/strict';
import { addressPayload, EMPTY_ADDRESS, maskCep, validateAddress } from '../src/utils/address.js';

const full = { postal_code: '80010-000', street: ' Rua das Flores ', number: '123', complement: '', neighborhood: 'Centro', city: 'Curitiba', state: 'pr' };

test('endereço vazio acusa todos os campos obrigatórios, menos o complemento', () => {
  const errors = validateAddress(EMPTY_ADDRESS);
  assert.deepEqual(Object.keys(errors).sort(), ['city', 'neighborhood', 'number', 'postal_code', 'state', 'street']);
});

test('endereço completo passa e o corpo da API sai limpo', () => {
  assert.deepEqual(validateAddress(full), {});
  assert.deepEqual(addressPayload(full), { postal_code: '80010-000', street: 'Rua das Flores', number: '123', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' });
  assert.equal(addressPayload({ ...full, complement: ' Apto 4 ' }).complement, 'Apto 4');
});

test('CEP: máscara e validação por 8 dígitos', () => {
  assert.equal(maskCep('80010000'), '80010-000');
  assert.equal(maskCep('800'), '800');
  assert.equal(maskCep('80010-000999'), '80010-000');
  assert.ok(validateAddress({ ...full, postal_code: '8001' }).postal_code);
  assert.ok(validateAddress({ ...full, state: 'Paraná' }).state);
});
