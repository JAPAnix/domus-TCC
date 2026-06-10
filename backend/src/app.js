import express from 'express';
import router from './routes/index.js';
import { validateEnv } from './config/env.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';

// Valida variáveis de ambiente antes de qualquer coisa
validateEnv();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();

app.use(express.json());
app.use('/api', router);
app.use(errorMiddleware); // deve ser o último middleware

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));