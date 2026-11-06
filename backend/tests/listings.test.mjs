import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStep, validateAll, netAmount, LISTING_LIMITS } from '../src/utils/listingRules.js';
import { resolveTransition, availableActions, computeAmounts, earliestDate, bookingDateError, weekdayOf } from '../src/utils/orderRules.js';

const complete = () => ({
  categoryId: 1, catalogItemId: 3, serviceModes: ['client_place'], city: 'Curitiba', state: 'PR', radiusKm: 20,
  title: 'Instalação de chuveiro elétrico', description: 'Instalo chuveiros elétricos com garantia de 90 dias e deixo tudo limpo e funcionando.',
  images: ['https://x/a.jpg', 'https://x/b.jpg', 'https://x/c.jpg'], included: ['Mão de obra'], excluded: [], requirements: '', materials: '',
  pricingModel: 'fixed', price: 150, travelFee: 20, packages: [],
  availability: { weekdays: [{ day: 1, from: '08:00', to: '18:00' }], leadTimeHours: 24 }, cancellationPolicy: 'flexible',
  verification: { legalName: 'Maria da Silva', documentOk: true },
});

test('um anúncio completo passa em todas as etapas', () => {
  assert.deepEqual(validateAll(complete()), []);
});

test('cada etapa aponta o campo e a mensagem do que falta', () => {
  assert.deepEqual(Object.keys(validateStep(1, {})), ['categoryId', 'catalogItemId']);
  assert.ok(validateStep(2, { serviceModes: [] }).serviceModes);
  assert.ok(validateStep(2, { serviceModes: ['no_ar'] }).serviceModes);
  assert.deepEqual(validateStep(3, { serviceModes: ['remote'] }), {}, 'só online não precisa de endereço');
  assert.deepEqual(Object.keys(validateStep(3, { serviceModes: ['client_place'] })).sort(), ['city', 'radiusKm', 'state']);
  assert.deepEqual(Object.keys(validateStep(3, { serviceModes: ['pro_place'] })).sort(), ['city', 'state'], 'raio só vale no atendimento na casa do cliente');
  assert.ok(validateStep(4, { title: 'curto', description: 'x'.repeat(60) }).title);
  assert.ok(validateStep(4, { title: 'x'.repeat(20), description: 'curta' }).description);
  assert.ok(validateStep(5, { images: ['a', 'b'] }).images.includes('3 fotos'));
  assert.ok(validateStep(5, { images: Array(11).fill('a') }).images);
  assert.ok(validateStep(6, { included: [] }).included);
  assert.ok(validateStep(6, { included: ['ok'], excluded: Array(16).fill('x') }).excluded);
  assert.ok(validateStep(7, {}).pricingModel);
  assert.ok(validateStep(7, { pricingModel: 'hourly' }).price);
  assert.deepEqual(validateStep(7, { pricingModel: 'quote' }), {}, 'sob consulta não tem preço');
  assert.ok(validateStep(7, { pricingModel: 'fixed', price: 10, packages: [{ name: '', price: 5 }] }).packages);
  assert.ok(validateStep(7, { pricingModel: 'fixed', price: 10, packages: [1, 2, 3].map((n) => ({ name: `P${n}`, price: n })) }).packages);
  assert.ok(validateStep(8, { availability: { weekdays: [] } }).availability);
  assert.ok(validateStep(8, { availability: { weekdays: [{ day: 1, from: '18:00', to: '08:00' }], leadTimeHours: 1 }, cancellationPolicy: 'flexible' }).availability);
  assert.ok(validateStep(8, { availability: { weekdays: [{ day: 1, from: '08:00', to: '18:00' }, { day: 1, from: '09:00', to: '10:00' }], leadTimeHours: 1 }, cancellationPolicy: 'flexible' }).availability);
  assert.ok(validateStep(8, { availability: { weekdays: [{ day: 1, from: '08:00', to: '18:00' }], leadTimeHours: -1 }, cancellationPolicy: 'flexible' }).leadTimeHours);
  assert.ok(validateStep(8, { availability: { weekdays: [{ day: 1, from: '08:00', to: '18:00' }], leadTimeHours: 5 } }).cancellationPolicy);
  assert.deepEqual(Object.keys(validateStep(9, {})).sort(), ['document', 'legalName']);
});

test('publicar exige as 9 etapas e informa a etapa de cada erro', () => {
  const draft = { ...complete(), title: '', images: [] };
  const errors = validateAll(draft);
  assert.deepEqual(errors.map((item) => item.step).sort(), [4, 5]);
  assert.ok(errors.every((item) => item.field && item.message));
  assert.ok(LISTING_LIMITS.images[0] === 3);
});

test('quanto o profissional recebe, com e sem taxa', () => {
  assert.equal(netAmount(100, 0), 100);
  assert.equal(netAmount(100, 10), 90);
  assert.equal(netAmount(99.99, 12.5), 87.49);
  assert.equal(netAmount(null, 10), null);
  assert.equal(netAmount('abc', 0), null);
});

const order = (status, extra = {}) => ({ clientId: 1n, professionalId: 2n, status, ...extra });

test('transições da contratação por papel e status', () => {
  assert.equal(resolveTransition(order('requested'), 2n, 'accept').to, 'accepted');
  assert.equal(resolveTransition(order('requested'), 2n, 'decline').to, 'declined');
  assert.equal(resolveTransition(order('accepted'), 2n, 'start').to, 'in_progress');
  assert.equal(resolveTransition(order('in_progress'), 2n, 'complete').to, 'completed');
  assert.equal(resolveTransition(order('requested'), 1n, 'cancel').to, 'cancelled', 'cliente cancela pedido novo');
  assert.equal(resolveTransition(order('in_progress'), 1n, 'cancel').to, 'cancelled');
  assert.equal(resolveTransition(order('accepted'), 2n, 'cancel').to, 'cancelled', 'profissional cancela depois de aceitar');
  assert.throws(() => resolveTransition(order('requested'), 2n, 'cancel'), (e) => e.status === 409, 'profissional recusa, não cancela, pedido novo');
});

test('ninguém faz ação que não é sua nem em status errado', () => {
  assert.throws(() => resolveTransition(order('requested'), 1n, 'accept'), (e) => e.status === 403, 'cliente não aceita');
  assert.throws(() => resolveTransition(order('in_progress'), 1n, 'complete'), (e) => e.status === 403, 'cliente não conclui');
  assert.throws(() => resolveTransition(order('requested'), 9n, 'accept'), (e) => e.status === 403, 'estranho');
  assert.throws(() => resolveTransition(order('accepted'), 2n, 'accept'), (e) => e.status === 409, 'aceitar duas vezes');
  assert.throws(() => resolveTransition(order('completed'), 1n, 'cancel'), (e) => e.status === 409, 'concluído não muda');
  assert.throws(() => resolveTransition(order('cancelled'), 2n, 'start'), (e) => e.status === 409);
  assert.throws(() => resolveTransition(order('requested'), 2n, 'explodir'), (e) => e.status === 404);
});

test('botões disponíveis por papel', () => {
  assert.deepEqual(availableActions(order('requested'), 2n).sort(), ['accept', 'decline']);
  assert.deepEqual(availableActions(order('requested'), 1n), ['cancel']);
  assert.deepEqual(availableActions(order('accepted'), 2n).sort(), ['cancel', 'start']);
  assert.deepEqual(availableActions(order('in_progress'), 2n).sort(), ['cancel', 'complete']);
  assert.deepEqual(availableActions(order('completed'), 1n), []);
  assert.deepEqual(availableActions(order('declined'), 2n), []);
});

test('valores copiados do anúncio: pacote, deslocamento e total', () => {
  const base = { pricingModel: 'fixed', price: '200.00', travelFee: '30.00', packages: [{ name: 'Básico', price: 120 }, { name: 'Completo', price: 300 }] };
  assert.deepEqual(computeAmounts(base, { serviceMode: 'client_place' }), { price: 200, travelFee: 30, total: 230 });
  assert.deepEqual(computeAmounts(base, { serviceMode: 'pro_place' }), { price: 200, travelFee: null, total: 200 }, 'sem deslocamento fora da casa do cliente');
  assert.deepEqual(computeAmounts(base, { serviceMode: 'client_place', packageName: 'Completo' }), { price: 300, travelFee: 30, total: 330 });
  assert.throws(() => computeAmounts(base, { serviceMode: 'remote', packageName: 'Inexistente' }), (e) => e.status === 400);
  assert.equal(computeAmounts({ ...base, pricingModel: 'hourly' }, { serviceMode: 'remote' }).total, null, 'por hora: total só no fim');
  assert.deepEqual(computeAmounts({ pricingModel: 'quote', price: null, travelFee: null, packages: null }, { serviceMode: 'remote' }), { price: null, travelFee: null, total: null });
});

test('datas: antecedência, dia da semana e datas bloqueadas', () => {
  const now = new Date(2030, 0, 7, 15, 0); // segunda, 7/1/2030
  assert.equal(earliestDate(now, 0), '2030-01-07');
  assert.equal(earliestDate(now, 24), '2030-01-08');
  assert.equal(earliestDate(now, 25), '2030-01-09');
  assert.equal(weekdayOf('2030-01-07'), 1);
  const availability = { leadTimeHours: 24, weekdays: [{ day: 3, from: '08:00', to: '12:00' }, { day: 5, from: '08:00', to: '12:00' }] };
  assert.equal(bookingDateError(availability, '2030-01-09', now), null, 'quarta, com antecedência');
  assert.match(bookingDateError(availability, '2030-01-08', now), /dia da semana/, 'terça: não atende');
  assert.match(bookingDateError(availability, '2030-01-07', now), /antecedência/, 'hoje: antecedência de 24 h');
  assert.match(bookingDateError(availability, '2030-01-04', now), /antecedência/, 'passado');
  assert.match(bookingDateError(availability, '2030-01-09', now, new Set(['2030-01-09'])), /não está disponível/);
  assert.match(bookingDateError(availability, '2030-02-30', now), /válida/);
  assert.match(bookingDateError(availability, 'amanhã', now), /válida/);
});
