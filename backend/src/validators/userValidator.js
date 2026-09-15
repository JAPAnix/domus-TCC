import { z } from 'zod';

export const updateUserSchema = z.object({
  email: z.never({ error: 'Confirme o email em Informações pessoais antes de alterá-lo.' }).optional(),
  first_name: z.string().trim().min(2).max(100).optional(),
  last_name: z.string().trim().min(2).max(100).optional(),
  phone_number: z.never({ error: 'Confirme o telefone em Informações pessoais antes de alterá-lo.' }).optional(),
  profile_picture_url: z.string().url('URL inválida').max(2048).optional(),
  zip_code: z.string().max(9).optional(),
  street: z.string().max(255).optional(),
  number: z.string().max(20).optional(),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().length(2).optional()
});
