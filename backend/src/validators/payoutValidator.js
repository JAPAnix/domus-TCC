import { z } from 'zod';
import { isValidCnpj, isValidCpf, onlyDigits } from '../utils/taxDocument.js';

const text = (label, max) => z.string({ error: `Informe ${label}.` }).trim().min(1, `Informe ${label}.`).max(max, `Use no máximo ${max} caracteres.`);

/** Dados para abrir a conta de recebimento no gateway. CPF para pessoa física e CNPJ para empresa. */
export const payoutAccountSchema = z.object({
  name: text('o nome completo ou a razão social', 150),
  email: z.string({ error: 'Informe o e-mail.' }).trim().email('E-mail inválido.').max(150),
  cpf_cnpj: z.string({ error: 'Informe o CPF ou CNPJ.' }).trim(),
  mobile_phone: z.string({ error: 'Informe o celular.' }).trim(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de nascimento.').optional(),
  company_type: z.enum(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'], { error: 'Escolha o tipo da empresa.' }).optional(),
  income_value: z.number({ error: 'Informe a renda ou o faturamento mensal.' }).positive('Informe um valor maior que zero.').max(100000000),
  address: text('a rua', 150),
  address_number: text('o número', 20),
  complement: z.string().trim().max(100).optional(),
  province: text('o bairro', 100),
  postal_code: z.string({ error: 'Informe o CEP.' }).trim(),
}).superRefine((value, ctx) => {
  const digits = onlyDigits(value.cpf_cnpj);
  const person = digits.length === 11;
  if (!(person ? isValidCpf(digits) : digits.length === 14 && isValidCnpj(digits))) ctx.addIssue({ code: 'custom', path: ['cpf_cnpj'], message: 'CPF ou CNPJ inválido. Confira os dígitos.' });
  if (person && !value.birth_date) ctx.addIssue({ code: 'custom', path: ['birth_date'], message: 'Informe a data de nascimento.' });
  if (digits.length === 14 && !value.company_type) ctx.addIssue({ code: 'custom', path: ['company_type'], message: 'Escolha o tipo da empresa.' });
  if (onlyDigits(value.postal_code).length !== 8) ctx.addIssue({ code: 'custom', path: ['postal_code'], message: 'CEP inválido. Use 8 dígitos.' });
  const phone = onlyDigits(value.mobile_phone);
  if (phone.length < 10 || phone.length > 11) ctx.addIssue({ code: 'custom', path: ['mobile_phone'], message: 'Celular inválido. Use DDD e número.' });
});

export const startAsaasSchemaExtras = z.object({
  installments: z.number().int().min(1).max(12).optional(),
  cpf_cnpj: z.string().trim().max(20).optional(),
});

export const disputeSchema = z.object({ reason: z.string({ error: 'Conte o que aconteceu.' }).trim().min(10, 'Conte o que aconteceu, de 10 a 500 caracteres.').max(500, 'Use no máximo 500 caracteres.') });
export const resolveSchema = z.object({ decision: z.enum(['release', 'refund'], { error: 'Escolha liberar ou estornar.' }), note: z.string().trim().max(500).optional() });
