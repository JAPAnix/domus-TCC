import { z } from 'zod';
import { SERVICE_MODES, PRICING_MODELS, CANCELLATION_POLICIES } from '../utils/listingRules.js';
import { isValidCpf, isValidCnpj } from '../utils/taxDocument.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageUrl = z.string().url('Link de imagem inválido').max(2048).regex(/^https?:\/\//, 'Link de imagem inválido');
const text = (max) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).nullable().optional();
const money = z.number().min(0).max(1000000).nullable().optional();
const tagList = (maxItems, maxLength) => z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).optional();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido');

/** Rascunho: todos os campos são opcionais. A completude é conferida por etapa (validate_step) e ao publicar. */
export const listingDraftSchema = z.object({
  wizard_step: z.number().int().min(1).max(10).optional(),
  validate_step: z.number().int().min(1).max(10).optional(),
  category_id: z.number().int().positive().nullable().optional(),
  catalog_item_id: z.number().int().positive().nullable().optional(),
  service_modes: z.array(z.enum(SERVICE_MODES)).max(3).optional(),
  city: text(100),
  state: z.string().trim().length(2, 'Use a sigla do estado.').nullable().optional().or(z.literal('')),
  radius_km: z.number().int().min(1).max(500).nullable().optional(),
  title: text(120),
  description: text(3000),
  image_urls: z.array(imageUrl).max(10, 'Use no máximo 10 fotos').optional(),
  included: tagList(15, 120),
  excluded: tagList(15, 120),
  requirements: text(1000),
  materials: text(1000),
  pricing_model: z.enum(PRICING_MODELS).nullable().optional(),
  price: money,
  travel_fee: money,
  packages: z.array(z.object({ name: z.string().trim().min(1).max(40), price: z.number().positive().max(1000000), description: z.string().trim().max(200).optional() })).max(2).optional(),
  availability: z.object({
    weekdays: z.array(z.object({ day: z.number().int().min(0).max(6), from: time, to: time })).max(7),
    lead_time_hours: z.number().int().min(0).max(720),
  }).nullable().optional(),
  cancellation_policy: z.enum(CANCELLATION_POLICIES).nullable().optional(),
});

export const verificationSchema = z.object({
  legal_name: z.string().trim().min(3, 'Informe o nome completo ou a razão social.').max(150),
  document_type: z.enum(['cpf', 'cnpj'], { error: 'Escolha CPF ou CNPJ.' }),
  document: z.string().trim().max(30),
}).superRefine((value, ctx) => {
  const valid = value.document_type === 'cpf' ? isValidCpf(value.document) : isValidCnpj(value.document);
  if (!valid) ctx.addIssue({ code: 'custom', path: ['document'], message: value.document_type === 'cpf' ? 'CPF inválido. Confira os 11 dígitos.' : 'CNPJ inválido. Confira os 14 dígitos.' });
});

const clean = (label, max) => z.string({ error: `Informe ${label}.` }).trim().min(1, `Informe ${label}.`).max(max, `Use no máximo ${max} caracteres.`);

/** Endereço do serviço (modo "na casa do cliente"). Só vai ao profissional depois que ele aceita o pedido. */
export const serviceAddressSchema = z.object({
  postal_code: z.string({ error: 'Informe o CEP.' }).trim().regex(/^\d{5}-?\d{3}$/, 'CEP inválido. Use 8 dígitos.'),
  street: clean('a rua', 120),
  number: clean('o número', 20),
  complement: z.string().trim().max(80, 'Use no máximo 80 caracteres.').optional(),
  neighborhood: clean('o bairro', 80),
  city: clean('a cidade', 80),
  state: z.string({ error: 'Informe o estado.' }).trim().length(2, 'Use a sigla do estado, com 2 letras.').transform((value) => value.toUpperCase()),
});

export const bookingSchema = z.object({
  listing_uuid: z.string().regex(UUID, 'Anúncio inválido.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha uma data válida.'),
  service_mode: z.enum(SERVICE_MODES, { error: 'Escolha a forma de atendimento.' }),
  package_name: z.string().trim().max(60).nullable().optional(),
  note: z.string().trim().max(1000, 'Use no máximo 1000 caracteres.').nullable().optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Escolha o horário.').nullable().optional(),
  quantity: z.number().int('Informe um número inteiro.').min(1, 'Informe pelo menos 1.').max(30, 'Quantidade alta demais.').nullable().optional(),
  image_urls: z.array(z.string().url().max(500)).max(5, 'Envie no máximo 5 fotos.').optional(),
  service_address: serviceAddressSchema.optional(),
});

export const completeSchema = z.object({
  final_amount: z.number({ error: 'Informe o valor final do serviço.' }).positive('Informe um valor maior que zero.').max(1000000, 'Valor alto demais.'),
});

export const availabilityToggleSchema = z.object({ blocked: z.boolean() });
