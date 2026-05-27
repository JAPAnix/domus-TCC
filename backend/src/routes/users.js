import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.get('/perfil', authMiddleware, (req, res) => {
  res.json({ message: `Olá, ${req.user.email}` });
});

export default router;