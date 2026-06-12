import express from 'express';
import cors from 'cors';
import router from './routes/index.js';
import { validateEnv } from './config/env.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';

validateEnv();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use('/api', router);
app.use(errorMiddleware);

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));