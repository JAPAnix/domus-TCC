import test from 'node:test';
import assert from 'node:assert/strict';
import { likePattern } from '../src/utils/textSearch.js';

const B = String.fromCharCode(92);

test('padrão de busca: envolve em % e trata curingas do termo como texto', () => {
  assert.equal(likePattern('pintura'), '%pintura%');
  assert.equal(likePattern('100%'), `%100${B}%%`);
  assert.equal(likePattern('a_b'), `%a${B}_b%`);
  assert.equal(likePattern(`c:${B}x`), `%c:${B}${B}x%`);
  assert.equal(likePattern('São João'), '%São João%');
});
