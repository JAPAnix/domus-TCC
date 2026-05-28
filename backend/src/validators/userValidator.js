import { z } from 'zod';

export const updateUserSchema = z.object({
  first_name: z.string().min(2).max(100).optional(),
  last_name: z.string().min(2).max(100).optional(),
  phone_number: z.string().max(20).optional(),
  profile_picture_url: z.string().url('URL inválida').max(2048).optional()
});