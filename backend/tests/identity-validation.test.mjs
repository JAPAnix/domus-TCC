import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCpf } from '../../frontend/src/pages/settings/identityValidation.js';

test('CPF accepts valid check digits, with or without mask', () => {
  assert.equal(isValidCpf('52998224725'), true);
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('11144477735'), true);
});
test('CPF rejects empty, malformed, repeated and incorrect digits', () => {
  for (const value of ['', null, undefined, 52998224725, '123', '12345678901', '52998224724', '52998224715', 'abc52998224725', '529982247250']) assert.equal(isValidCpf(value), false);
  for (let digit = 0; digit <= 9; digit++) assert.equal(isValidCpf(String(digit).repeat(11)), false);
});
