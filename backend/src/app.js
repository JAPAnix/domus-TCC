import express from 'express';
import cors from 'cors';
import router from './routes/index.js';
import { validateEnv } from './config/env.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { pathToFileURL } from 'node:url';
import { prisma } from './config/prisma.js';

validateEnv();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const app = express();
app.disable('x-powered-by');
// Render terminates HTTPS and forwards requests through its reverse proxy.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [new URL(process.env.FRONTEND_URL).origin]
    : [...new Set(['http://localhost:5173', 'http://127.0.0.1:5173', ...(process.env.FRONTEND_URL ? [new URL(process.env.FRONTEND_URL).origin] : [])])],
  credentials: true
}));

app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', router);
app.use(errorMiddleware);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => console.log(`Servidor rodando na porta ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    const timer = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => { await prisma.$disconnect(); clearTimeout(timer); process.exit(0); });
  });
}
