import { z } from 'zod';
import { MESSAGE_LIMITS } from '../utils/messageRules.js';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Identificador inválido');

export const openConversationSchema = z.object({ listing_uuid: uuid.optional(), order_uuid: uuid.optional() })
  .refine((value) => !!value.listing_uuid !== !!value.order_uuid, { message: 'Informe o serviço ou o pedido.' });

export const sendMessageSchema = z.object({
  body: z.string().max(MESSAGE_LIMITS.body, `A mensagem pode ter no máximo ${MESSAGE_LIMITS.body} caracteres.`).default(''),
  image_url: z.string().url('Link de imagem inválido').max(500).regex(/^https?:\/\//, 'Link de imagem inválido').nullable().optional(),
});

export const reportSchema = z.object({
  reason: z.enum(['spam', 'abuse', 'scam', 'inappropriate', 'other'], { error: 'Escolha o motivo da denúncia.' }),
  details: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional(),
});

export const quickReplySchema = z.object({
  title: z.string().trim().min(1, 'Dê um nome ao modelo.').max(MESSAGE_LIMITS.replyTitle, `Use no máximo ${MESSAGE_LIMITS.replyTitle} caracteres.`),
  body: z.string().trim().min(1, 'Escreva o texto do modelo.').max(MESSAGE_LIMITS.replyBody, `Use no máximo ${MESSAGE_LIMITS.replyBody} caracteres.`),
  listing_uuid: uuid.nullable().optional(),
  schedule: z.enum(['none', 'before_service', 'after_service', 'review_request']).optional(),
  offset_hours: z.number().int().min(1, 'Use ao menos 1 hora.').max(168, 'Use no máximo 168 horas (7 dias).').optional(),
});

export const prefsSchema = z.object({ suggestions: z.boolean({ error: 'Informe se quer sugestões.' }) });

export const feedbackSchema = z.object({
  kind: z.enum(['idea', 'bug'], { error: 'Escolha o tipo de feedback.' }),
  message: z.string().trim().min(10, 'Conte um pouco mais (mínimo de 10 caracteres).').max(2000, 'Use no máximo 2000 caracteres.'),
  page: z.string().max(200).optional(),
});
