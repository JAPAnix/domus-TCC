import { Router } from 'express';
import { z } from 'zod';
import authMiddleware from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { replyToReview } from '../services/listingPageService.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authMiddleware);

router.post('/:id/reply', validate(z.object({ reply: z.string().trim().min(2, 'Escreva uma resposta.').max(500, 'Use no máximo 500 caracteres.') })), async (req, res) => {
  try { res.status(201).json(await replyToReview(BigInt(req.user.id), req.params.id, req.body.reply)); } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('reviews.reply', err);
    return res.status(500).json({ message: 'Não foi possível enviar a resposta.' });
  }
});

export default router;
