import { z } from 'zod';

export const updateUserSchema = z.object({
  first_name: z.string().min(2).max(100).optional(),
  last_name: z.string().min(2).max(100).optional(),
  phone_number: z.string().max(20).optional(),
  profile_picture_url: z.string().url('URL inválida').max(2048).optional(),
  zip_code: z.string().max(9).optional(),
  street: z.string().max(255).optional(),
  number: z.string().max(20).optional(),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional()
});