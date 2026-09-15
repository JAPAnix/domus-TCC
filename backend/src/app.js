import express from 'express';
import cors from 'cors';
import router from './routes/index.js';
import { validateEnv } from './config/env.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { pathToFileURL } from 'node:url';

validateEnv();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use('/api', router);
app.use(errorMiddleware);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
}
