import { z } from "zod";

const imageUrl = z.string().url("Link de imagem inválido").max(2048).regex(/^https?:\/\//, "Link de imagem inválido");

const serviceBaseSchema = z.object({
  title: z.string().min(5, "Título deve ter pelo menos 5 caracteres").max(255),
  description: z
    .string()
    .min(20, "Descrição deve ter pelo menos 20 caracteres"),
  category_id: z.number().int().positive(),
  budget_min: z.number().positive().optional(),
  budget_max: z.number().positive().optional(),
  deadline: z.string().date("Data inválida")
    .transform(value => new Date(value + "T00:00:00.000Z"))
    .optional(),
  image_urls: z.array(imageUrl).max(10, "Envie no máximo 10 fotos").optional(),
  city: z.string().trim().min(2, "Informe a cidade").max(100).optional(),
  state: z.string().trim().length(2, "Use a sigla do estado, com 2 letras").transform((value) => value.toUpperCase()).optional(),
  neighborhood: z.string().trim().max(100).optional(),
  // Pedido aberto: validade, quem pode responder e como o serviço pode ser feito.
  valid_days: z.number().int().refine((value) => [3, 7, 15, 30].includes(value), 'Escolha uma validade de 3, 7, 15 ou 30 dias.').optional(),
  only_verified: z.boolean().optional(),
  min_rating: z.number().min(1).max(5).optional(),
  modes: z.array(z.enum(['client_place', 'pro_place', 'remote'])).max(3).optional(),
});

export const draftSchema = z.object({ data: z.record(z.string(), z.unknown()) });
export const renewSchema = z.object({ days: z.number().int().refine((value) => [3, 7, 15, 30].includes(value), 'Escolha uma validade de 3, 7, 15 ou 30 dias.') });
export const reportSchema = z.object({ reason: z.enum(['contact', 'scam', 'prohibited', 'offensive', 'spam', 'other'], { error: 'Escolha o motivo da denúncia.' }), details: z.string().trim().max(500).optional(), proposal_uuid: z.string().uuid().optional() });
export const resolveReportSchema = z.object({ action: z.enum(['remove', 'dismiss'], { error: 'Escolha remover ou ignorar.' }), note: z.string().trim().min(5, 'Escreva uma justificativa curta (mínimo 5 caracteres).').max(500) });

export const createServiceSchema = serviceBaseSchema.extend({
  // Pedido novo precisa dizer onde será o serviço; edição de rascunho continua parcial.
  city: serviceBaseSchema.shape.city.unwrap(),
  state: serviceBaseSchema.shape.state.unwrap(),
}).refine(
  (data) => {
    if (data.budget_min && data.budget_max) {
      return data.budget_max >= data.budget_min;
    }
    return true;
  },
  { message: "budget_max deve ser maior ou igual ao budget_min" },
);

export const updateServiceSchema = serviceBaseSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled"]),
});
