import fs from 'node:fs';
import { prisma } from '../config/prisma.js';

const directory = new URL('../../prisma/migrations/', import.meta.url);
let cache = { at: 0, value: null };

/** Migrations que existem no código e ainda não foram aplicadas no banco. O /health mostra isso. */
export async function pendingMigrations(db = prisma, now = Date.now()) {
  if (cache.value && now - cache.at < 60000) return cache.value;
  let value;
  try {
    const expected = fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    const rows = await db.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`;
    const applied = new Set(rows.map((row) => row.migration_name));
    value = { ok: true, pending: expected.filter((name) => !applied.has(name)) };
  } catch {
    value = { ok: false, pending: [] };
  }
  cache = { at: now, value };
  return value;
}
