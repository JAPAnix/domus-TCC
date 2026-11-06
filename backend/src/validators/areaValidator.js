import { z } from 'zod';
import { SUPPORTED_LANGUAGES, SUPPORTED_CURRENCIES } from '../utils/locales.js';
import { isValidCpf, isValidCnpj, onlyDigits } from '../utils/taxDocument.js';
import { normalizeBrazilianPhone } from '../utils/userData.js';

// ---- Conta e segurança ----
export const changePasswordSchema = z.object({
  current_password: z.string().max(255).optional(),
  new_password: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.').max(255),
});
export const passwordConfirmSchema = z.object({ password: z.string().max(255).optional() });
export const googleLinkSchema = z.object({ credential: z.string().min(20) });
export const deleteConfirmSchema = z.object({
  token: z.string().min(20).max(1000),
  confirmation: z.literal('EXCLUIR', { error: 'Digite EXCLUIR para confirmar.' }),
});

// ---- Configurações ----
const nonEmpty = (schema) => schema.refine((value) => Object.keys(value).length > 0, { message: 'Nenhuma alteração enviada.' });

export const privacySchema = nonEmpty(z.object({
  profile_visibility: z.enum(['everyone', 'members', 'connections']).optional(),
  read_receipts: z.boolean().optional(),
  search_indexing: z.boolean().optional(),
  show_written_reviews: z.boolean().optional(),
}));

export const notificationsSchema = z.record(z.string(), z.record(z.string(), z.boolean()));

export const cookiesSchema = nonEmpty(z.object({ analytics: z.boolean().optional(), marketing: z.boolean().optional() }));

export const localeSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES, { error: 'Idioma indisponível.' }),
  currency: z.enum(SUPPORTED_CURRENCIES, { error: 'Moeda indisponível.' }),
});

export const taxSchema = z.object({
  document_type: z.enum(['cpf', 'cnpj'], { error: 'Escolha CPF ou CNPJ.' }),
  document: z.string().trim().max(30),
  holder_name: z.string().trim().min(3, 'Informe o nome completo ou a razão social.').max(150),
  payout_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']).nullable().optional(),
  payout_key: z.string().trim().max(140).nullable().optional(),
}).superRefine((value, ctx) => {
  const valid = value.document_type === 'cpf' ? isValidCpf(value.document) : isValidCnpj(value.document);
  if (!valid) ctx.addIssue({ code: 'custom', path: ['document'], message: value.document_type === 'cpf' ? 'CPF inválido. Confira os 11 dígitos.' : 'CNPJ inválido. Confira os 14 dígitos.' });
  if (value.payout_key_type && !value.payout_key) ctx.addIssue({ code: 'custom', path: ['payout_key'], message: 'Informe a chave Pix.' });
  const key = value.payout_key ?? '';
  const keyChecks = {
    cpf: () => isValidCpf(key), cnpj: () => isValidCnpj(key),
    email: () => z.string().email().safeParse(key).success,
    phone: () => { try { normalizeBrazilianPhone(key); return true; } catch { return false; } },
    random: () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key),
  };
  if (value.payout_key_type && key && !keyChecks[value.payout_key_type]()) ctx.addIssue({ code: 'custom', path: ['payout_key'], message: 'Chave Pix inválida para o tipo escolhido.' });
});

// Como o profissional recebe: chave Pix (opcional) e formas de pagamento aceitas.
export const receivingSchema = z.object({
  pix_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']).nullable().optional(),
  pix_key: z.string().trim().max(140).nullable().optional(),
  methods: z.array(z.enum(['pix', 'cash', 'card_in_person'])).min(1, 'Escolha pelo menos uma forma de receber.').max(3),
}).superRefine((value, ctx) => {
  const key = value.pix_key ?? '';
  if (key && !value.pix_key_type) ctx.addIssue({ code: 'custom', path: ['pix_key_type'], message: 'Escolha o tipo da chave Pix.' });
  if (value.pix_key_type && !key) ctx.addIssue({ code: 'custom', path: ['pix_key'], message: 'Informe a chave Pix.' });
  const checks = {
    cpf: () => isValidCpf(key), cnpj: () => isValidCnpj(key),
    email: () => z.string().email().safeParse(key).success,
    phone: () => { try { normalizeBrazilianPhone(key); return true; } catch { return false; } },
    random: () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key),
  };
  if (value.pix_key_type && key && !checks[value.pix_key_type]()) ctx.addIssue({ code: 'custom', path: ['pix_key'], message: 'Chave Pix inválida para o tipo escolhido.' });
  if (value.methods.includes('pix') && !key) ctx.addIssue({ code: 'custom', path: ['pix_key'], message: 'Para receber por Pix, informe a sua chave.' });
});

export function normalizePayoutKey(type, key) {
  if (!type || !key) return null;
  if (type === 'cpf' || type === 'cnpj') return onlyDigits(key);
  if (type === 'email') return key.trim().toLowerCase();
  if (type === 'phone') return normalizeBrazilianPhone(key);
  return key.trim().toLowerCase();
}

// ---- Perfil ----
const optionalText = (max) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).nullable().optional();
const tagList = (maxItems, maxLength) => z.array(z.string().trim().min(1).max(maxLength, `Cada item pode ter no máximo ${maxLength} caracteres.`))
  .max(maxItems, `Informe no máximo ${maxItems} itens.`).optional();

export const profileSchema = z.object({
  about: optionalText(1000),
  profession: optionalText(120),
  school: optionalText(120),
  fun_fact: optionalText(200),
  languages: tagList(10, 40),
  interests: tagList(12, 40),
  skills: tagList(15, 40),
  service_areas: tagList(10, 60),
  years_experience: z.number().int('Informe um número inteiro.').min(0, 'Use zero ou mais anos.').max(60, 'Use no máximo 60 anos.').nullable().optional(),
  city: optionalText(100),
  state: z.string().trim().length(2, 'Use a sigla do estado, com 2 letras.').nullable().optional().or(z.literal('')),
  profile_picture_url: z.string().url('Foto inválida.').max(2048).regex(/^https?:\/\//, 'Foto inválida.').nullable().optional(),
});

// ---- Ajuda ----
export const TICKET_CATEGORIES = ['primeiros-passos', 'contratar', 'profissional', 'pagamentos', 'mensagens', 'conta', 'cancelamentos', 'comunidade', 'outro'];

export const feedbackSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,120}$/, 'Artigo inválido.'),
  helpful: z.boolean(),
});

export const ticketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES, { error: 'Escolha um assunto.' }),
  subject: z.string().trim().min(5, 'O título precisa ter pelo menos 5 caracteres.').max(150),
  message: z.string().trim().min(20, 'Conte um pouco mais: a mensagem precisa ter pelo menos 20 caracteres.').max(5000),
  name: z.string().trim().min(2, 'Informe seu nome.').max(150).optional(),
  email: z.string().trim().email('E-mail inválido.').max(255).optional(),
});

export const blockSchema = z.object({ user_uuid: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Usuário inválido.') });

export const favoriteListSchema = z.object({ name: z.string().trim().min(1, 'Dê um nome à lista.').max(60, 'Use no máximo 60 caracteres.') });

export const favoriteItemSchema = z.object({
  type: z.enum(['professional', 'listing']),
  uuid: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Item inválido.'),
  list_ids: z.array(z.union([z.string().regex(/^\d{1,19}$/), z.number().int().positive()])).max(50),
});
