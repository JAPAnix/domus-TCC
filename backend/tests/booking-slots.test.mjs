import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addDays, daysOf, hourSlots, dayHours, slotError, busyOf, hasConflict, unitsTotal, normalizeQuantity } from '../src/utils/bookingSlots.js';

test('datas e horários', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.deepEqual(daysOf('2026-02-27', 3), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.deepEqual(hourSlots('09:00', 3), ['09:00', '10:00', '11:00']);
  assert.deepEqual(dayHours({ from: '08:00', to: '11:00' }), ['08:00', '09:00', '10:00']);
  assert.deepEqual(dayHours({ from: '08:30', to: '11:00' }), ['09:00', '10:00']);
  assert.deepEqual(dayHours(null), []);
});

test('quantidade e horário conforme o modelo de preço', () => {
  const window = { from: '08:00', to: '18:00' };
  assert.equal(slotError('hourly', { time: '09:00', quantity: 3 }, window), null);
  assert.match(slotError('hourly', { time: '09:00', quantity: 0 }, window), /1 a 12 horas/);
  assert.match(slotError('hourly', { time: '09:00', quantity: 13 }, window), /1 a 12 horas/);
  assert.match(slotError('hourly', { time: '09:30', quantity: 1 }, window), /horário de início/);
  assert.match(slotError('hourly', { time: '', quantity: 1 }, window), /horário de início/);
  assert.match(slotError('hourly', { time: '17:00', quantity: 2 }, window), /não atende em todo esse período/);
  assert.match(slotError('hourly', { time: '07:00', quantity: 1 }, window), /não atende/);
  assert.equal(slotError('daily', { quantity: 5 }), null);
  assert.match(slotError('daily', { quantity: 31 }), /1 a 30 dias/);
  assert.match(slotError('daily', { quantity: 1.5 }), /1 a 30 dias/);
  assert.equal(slotError('fixed', {}), null);
  assert.equal(normalizeQuantity('hourly', 2), 2);
  assert.equal(normalizeQuantity('hourly', undefined), 1);
  assert.equal(normalizeQuantity('fixed', 5), null);
});

test('conflitos por hora e por diária', () => {
  const orders = [
    { pricingModel: 'hourly', date: '2026-12-01', time: '09:00', quantity: 2 },
    { pricingModel: 'daily', date: '2026-12-10', quantity: 3 },
  ];
  assert.deepEqual(busyOf(orders), { hours: { '2026-12-01': ['09:00', '10:00'] }, days: ['2026-12-10', '2026-12-11', '2026-12-12'] });
  assert.equal(hasConflict({ pricingModel: 'hourly', date: '2026-12-01', time: '10:00', quantity: 1 }, orders), true);
  assert.equal(hasConflict({ pricingModel: 'hourly', date: '2026-12-01', time: '08:00', quantity: 2 }, orders), true);
  assert.equal(hasConflict({ pricingModel: 'hourly', date: '2026-12-01', time: '11:00', quantity: 2 }, orders), false);
  assert.equal(hasConflict({ pricingModel: 'hourly', date: '2026-12-02', time: '09:00', quantity: 1 }, orders), false);
  assert.equal(hasConflict({ pricingModel: 'daily', date: '2026-12-12', quantity: 2 }, orders), true);
  assert.equal(hasConflict({ pricingModel: 'daily', date: '2026-12-13', quantity: 2 }, orders), false);
  assert.equal(hasConflict({ pricingModel: 'fixed', date: '2026-12-10' }, orders), false);
});

test('total por hora e por diária', () => {
  assert.equal(unitsTotal('hourly', 60, 3, 20), 200);
  assert.equal(unitsTotal('daily', 250.5, 2), 501);
  assert.equal(unitsTotal('fixed', 100, 2), null);
  assert.equal(unitsTotal('hourly', null, 2), null);
});

test('o arquivo é idêntico no backend e no frontend', () => {
  const back = fs.readFileSync(new URL('../src/utils/bookingSlots.js', import.meta.url), 'utf8');
  const front = fs.readFileSync(new URL('../../frontend/src/utils/bookingSlots.js', import.meta.url), 'utf8');
  assert.equal(front, back);
});
