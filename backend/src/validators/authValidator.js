import { z } from 'zod';

export const registerSchema = z.object({
  first_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  last_name: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().trim().email('E-mail inválido').max(255),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(255),
  phone_number: z.string().max(20).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().email('E-mail inválido') });
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), newPassword: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(255) });
export const googleSchema = z.object({ credential: z.string().min(20) });
