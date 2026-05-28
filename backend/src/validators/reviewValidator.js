import { z } from 'zod';

export const createReviewSchema = z.object({
  reviewed_uuid: z.string().uuid('UUID inválido'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10, 'Comentário deve ter pelo menos 10 caracteres').optional()
});