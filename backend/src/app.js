import express from 'express';
import cors from 'cors';
import router from './routes/index.js';
import { validateEnv } from './config/env.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { pathToFileURL } from 'node:url';
import { uploadDirectory } from './services/storage/localStorage.js';
import { setEmailDispatcher } from './services/serviceWorkflow.js';
import { dispatchEventEmails } from './services/eventEmails.js';
import { attachRealtime } from './services/realtime.js';
import { startScheduler } from './services/messageService.js';

validateEnv();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

setEmailDispatcher(dispatchEventEmails);

export const app = express();

app.disable('x-powered-by');
// Atrás de um proxy (Render, Fly, etc.) defina TRUST_PROXY=1 para req.ip ser o do visitante e não o do proxy.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cross-Origin-Resource-Policy': 'same-site',
    ...(process.env.NODE_ENV === 'production' && { 'Strict-Transport-Security': 'max-age=15552000; includeSubDomains' }),
  });
  next();
});

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));

// Imagens do provedor local. Só arquivos gerados pelo servidor; nosniff impede interpretar como outro tipo.
app.use('/uploads', express.static(uploadDirectory, {
  dotfiles: 'deny', index: false, maxAge: '30d', immutable: true,
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

app.use('/api', router);
app.use(errorMiddleware);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
  attachRealtime(server);
  startScheduler();
}
