import { z } from 'zod';

export const createServiceSchema = z.object({
  title: z.string().min(5, 'Título deve ter pelo menos 5 caracteres').max(255),
  description: z.string().min(20, 'Descrição deve ter pelo menos 20 caracteres'),
  category_id: z.number().int().positive(),
  budget_min: z.number().positive().optional(),
  budget_max: z.number().positive().optional(),
  deadline: z.string().date('Data inválida').optional()
}).refine(data => {
  if (data.budget_min && data.budget_max) {
    return data.budget_max >= data.budget_min;
  }
  return true;
}, { message: 'budget_max deve ser maior ou igual ao budget_min' });

export const updateServiceSchema = createServiceSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled'])
});