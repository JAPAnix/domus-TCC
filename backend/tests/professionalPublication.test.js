import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublishable } from '../src/utils/professionalPublication.js';
import { createProfileSchema, updateProfileSchema } from '../src/validators/professionalValidator.js';

const complete = { displayName: 'Ana Silva', headline: 'Pintora', bio: 'Pintura residencial.', city: 'Sao Paulo', state: 'SP', serviceRegion: 'Centro', billingMode: 'quote', catalogServiceIds: [1], availabilityDates: ['2026-12-01'] };
test('quote profiles can publish without fixed prices', () => assert.doesNotThrow(() => assertPublishable(complete)));
test('hourly and daily profiles require a positive matching price', () => {
  for (const [mode,field] of [['hourly','hourlyRate'],['daily','dailyRate']]) {
    assert.throws(() => assertPublishable({...complete,billingMode:mode,[field]:0}));
    assert.doesNotThrow(() => assertPublishable({...complete,billingMode:mode,[field]:50}));
  }
});
test('publication cannot omit required identity, area, services or dates', () => {
  for(const field of ['displayName','headline','bio','city','state','serviceRegion','catalogServiceIds','availabilityDates']) {
    assert.throws(() => assertPublishable({...complete,[field]:Array.isArray(complete[field])?[]:''}),field);
  }
});
test('validator rejects unsafe image protocols, impossible dates and invalid state', () => {
  for(const body of [{public_photo_url:'javascript:alert(1)'},{portfolio_urls:['file:///tmp/picture.jpg']},{availability_dates:['2026-02-30']},{state:'XX'},{hourly_rate:-1}]) assert.equal(createProfileSchema.safeParse(body).success,false);
  assert.equal(createProfileSchema.safeParse({public_photo_url:'https://example.com/photo.jpg', availability_dates:['2028-02-29'],state:'sp',billing_mode:'quote'}).success,true);
});
test('partial updates retain unspecified fields for controller validation', () => {
  const result=updateProfileSchema.parse({billing_mode:'quote'});
  assert.equal(result.billing_mode,'quote');
  assert.equal(Object.hasOwn(result,'hourly_rate'),false);
});
