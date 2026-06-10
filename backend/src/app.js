import express from 'express';
import router from './routes/index.js';

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();

app.use(express.json());
app.use('/api', router);

app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.url}`);
  res.status(404).json({ message: 'Rota não encontrada' });
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));