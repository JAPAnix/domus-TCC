import { z } from 'zod';

// Senhas que qualquer pessoa tenta primeiro. Não é uma lista completa: só barra as mais óbvias.
const COMMON = new Set(['12345678', '123456789', '1234567890', '87654321', 'password', 'password1', 'senha123', 'senha1234', 'qwerty123', 'qwertyui', 'abc12345', '11111111', '00000000', 'iloveyou', 'brasil123', 'mudar123', 'admin123']);

/** Mesma regra no cadastro, na redefinição ("esqueci minha senha") e na troca de senha. */
export const passwordSchema = (label = 'Senha') => z.string()
  .min(8, `${label} deve ter pelo menos 8 caracteres`)
  .max(255, `${label} deve ter no máximo 255 caracteres`)
  .refine((value) => !COMMON.has(value.toLowerCase()), `${label} muito comum. Escolha outra mais difícil de adivinhar`)
  .refine((value) => new Set(value).size > 2, `${label} muito simples. Misture letras, números ou símbolos`);
