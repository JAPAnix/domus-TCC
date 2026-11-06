import test from 'node:test';
import assert from 'node:assert/strict';

// Garante que o caminho de falha da aprovação de teste usa só funções que existem no logger.
test('logger tem os métodos usados pelo serviço de contas de recebimento', async () => {
  const { logger } = await import('../src/utils/logger.js');
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/services/payoutAccounts.js', import.meta.url), 'utf8');
  for (const [, method] of source.matchAll(/logger\.(\w+)\(/g)) assert.equal(typeof logger[method], 'function', `logger.${method} não existe`);
});
