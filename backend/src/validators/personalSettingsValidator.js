import { z } from 'zod';

const text = (max) => z.string().trim().max(max, `Use até ${max} caracteres.`);
const required = (max) => text(max).min(1, 'Campo obrigatório.');
const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export function normalizePhone(value) {
  if (typeof value !== 'string' || /[^\d+\s().-]/.test(value)) throw new Error('Telefone inválido.');
  let digits = value.replace(/\D/g, '');
  if (!value.trim().startsWith('+')) digits = `55${digits}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('Telefone inválido.');
  if (digits.startsWith('55') && !/^55[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(digits)) throw new Error('Telefone inválido. Informe DDD e número.');
  return `+${digits}`;
}
const phone = z.string().max(30).transform((value, ctx) => {
  try { return normalizePhone(value); } catch (err) { ctx.addIssue({ code: 'custom', message: err.message }); return z.NEVER; }
});
const date = z.string().refine((value) => {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= today;
}, 'Informe uma data válida que não esteja no futuro.');
export const addressSchema = z.object({
  zip_code: z.string().trim().regex(/^\d{5}-?\d{3}$/, 'CEP inválido.').transform((v) => v.replace('-', '')),
  street: required(255), number: required(20), complement: text(100), neighborhood: required(100), city: required(100),
  state: z.string().trim().toUpperCase().refine((v) => states.includes(v), 'UF inválida.'),
}).strict();
export const personalSchemas = {
  nome: z.object({ first_name: required(100), last_name: required(100) }).strict(),
  preferencia: z.object({ preferred_name: text(100) }).strict(),
  nascimento: z.object({ birth_date: date.or(z.literal('')) }).strict(),
  residencial: addressSchema,
  postal: z.discriminatedUnion('same_as_home', [z.object({ same_as_home: z.literal(true) }).strict(), z.object({ same_as_home: z.literal(false), address: addressSchema }).strict()]),
  emergencia: z.union([z.object({ contact: z.null() }).strict(), z.object({ name: required(100), relationship: z.enum(['Familiar', 'Responsável', 'Amigo', 'Outro']), phone }).strict()]),
};
export const contactTargetSchemas = {
  email: z.object({ target: z.string().trim().toLowerCase().email('Informe um email válido.').max(255) }).strict(),
  phone: z.object({ target: phone }).strict(),
};
export const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Informe o código de 6 dígitos.') }).strict();
