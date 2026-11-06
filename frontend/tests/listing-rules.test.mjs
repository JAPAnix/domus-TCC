import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateStep, validateAll } from '../src/utils/listingRules.js';
import * as backend from '../../backend/src/utils/listingRules.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('a cópia das regras do anúncio no frontend é idêntica à do backend', () => {
  assert.equal(read('../src/utils/listingRules.js'), read('../../backend/src/utils/listingRules.js'));
});

test('as duas cópias dão o mesmo resultado em vários anúncios', () => {
  const base = { categoryId: 1, catalogItemId: 2, serviceModes: ['client_place'], city: 'Curitiba', state: 'PR', radiusKm: 10, title: 'Instalação de chuveiro elétrico', description: 'x'.repeat(60), images: ['a', 'b', 'c'], included: ['a'], pricingModel: 'fixed', price: 10, availability: { weekdays: [{ day: 1, from: '08:00', to: '10:00' }], leadTimeHours: 1 }, cancellationPolicy: 'strict', verification: { legalName: 'Maria', documentOk: true } };
  for (const variant of [base, {}, { ...base, title: '' }, { ...base, images: [] }, { ...base, serviceModes: ['remote'], city: '' }, { ...base, pricingModel: 'quote', price: null }]) {
    assert.deepEqual(validateAll(variant), backend.validateAll(variant));
    for (let step = 1; step <= 10; step++) assert.deepEqual(validateStep(step, variant), backend.validateStep(step, variant));
  }
});
