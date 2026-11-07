import test from 'node:test';
import assert from 'node:assert/strict';
import { addressFor } from '../src/utils/orderRules.js';
import { bookingSchema } from '../src/validators/listingValidator.js';

const address = { postal_code: '80010-000', street: 'Rua das Flores', number: '123', complement: 'Apto 4', neighborhood: 'Centro', city: 'Curitiba', state: 'PR' };
const order = (status) => ({ clientId: 1n, professionalId: 2n, status, serviceAddress: address });
const UUID = '6e53ab73-5e49-480b-8d7b-4b5ce0be53f2';
const base = { listing_uuid: UUID, date: '2026-11-17', service_mode: 'client_place' };

test('endereço: o cliente vê tudo; o profissional só bairro e cidade até aceitar', () => {
  assert.deepEqual(addressFor(order('requested'), 1n), address);
  const partial = addressFor(order('requested'), 2n);
  assert.deepEqual(partial, { neighborhood: 'Centro', city: 'Curitiba', state: 'PR', partial: true });
  for (const status of ['accepted', 'in_progress', 'completed']) assert.deepEqual(addressFor(order(status), 2n), address);
  assert.equal(addressFor(order('declined'), 2n).partial, true);
  assert.equal(addressFor({ ...order('requested'), serviceAddress: null }, 2n), null);
});

test('endereço: validação do corpo do pedido', () => {
  assert.equal(bookingSchema.safeParse({ ...base, service_address: address }).success, true);
  assert.equal(bookingSchema.parse({ ...base, service_address: { ...address, state: 'pr' } }).service_address.state, 'PR');
  for (const bad of [{ postal_code: '123' }, { street: '  ' }, { number: '' }, { state: 'Paraná' }, { city: '' }]) {
    assert.equal(bookingSchema.safeParse({ ...base, service_address: { ...address, ...bad } }).success, false, JSON.stringify(bad));
  }
});
