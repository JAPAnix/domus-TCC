import { backendUrl } from '../lib/env.mjs';
process.env.DATABASE_HOST = '127.0.0.1'; process.env.DATABASE_PORT = String(process.env.E2E_DB_PORT ?? 3307); process.env.DATABASE_USER = 'root'; process.env.DATABASE_PASSWORD = ''; process.env.DATABASE_NAME = (process.env.E2E_DB ?? 'dommos_teste'); process.env.JWT_SECRET = 'teste-local-e2e-1234567890-abcdef'; process.env.FRONTEND_URL = 'http://localhost:5183';
const m = await import(backendUrl('src/services/openRequests.js'));
const { prisma } = await import(backendUrl('src/config/prisma.js'));
const out = { expiry: await m.runOpenRequestExpiry(), digest: await m.runOpportunityDigest() };
console.log(JSON.stringify(out));
await prisma.$disconnect();
process.exitCode = 0;
