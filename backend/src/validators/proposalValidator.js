import { z } from 'zod';

export const createProposalSchema = z.object({
  proposed_price: z.number().positive('Preço deve ser maior que zero'),
  cover_letter: z.string().min(20, 'Carta de apresentação deve ter pelo menos 20 caracteres').optional(),
  delivery_time_days: z.number().int().positive().optional(),
  included: z.string().trim().max(500, 'O que está incluso pode ter até 500 caracteres.').optional(),
  valid_hours: z.number().int().min(1).max(720).optional(),
});

export const editProposalSchema = createProposalSchema;

export const updateProposalStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'withdrawn'])
});