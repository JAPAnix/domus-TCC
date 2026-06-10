import { logger } from '../utils/logger.js';

export const errorMiddleware = (err, req, res, next) => {
  logger.error(`${req.method} ${req.url}`, err);

  // Erros do Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'Registro duplicado' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'Registro não encontrado' });
  }

  // Erros de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Token inválido' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expirado' });
  }

  // Erro genérico
  res.status(500).json({ message: 'Erro interno do servidor' });
};