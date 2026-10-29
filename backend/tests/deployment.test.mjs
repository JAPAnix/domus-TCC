import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

test('production health and CORS work without a database connection', async () => {
  Object.assign(process.env, {
    NODE_ENV: 'production', PORT: '3000',
    FRONTEND_URL: 'https://frontend-test.invalid/tecti/2026/gpec10/',
    JWT_SECRET: 'test-only-secret-never-use-in-production-123',
    DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '1',
    DATABASE_USER: 'test', DATABASE_PASSWORD: 'test', DATABASE_NAME: 'test',
  });
  const { app } = await import('../src/app.js');
  const { prisma } = await import('../src/config/prisma.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${url}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const allowed = await fetch(`${url}/api/services`, { method: 'OPTIONS', headers: {
      Origin: 'https://frontend-test.invalid',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    } });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://frontend-test.invalid');
    assert.match(allowed.headers.get('access-control-allow-headers'), /authorization/);
    for (const origin of ['https://untrusted.invalid', 'http://localhost:5173']) {
      const response = await fetch(`${url}/health`, { headers: { Origin: origin } });
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
