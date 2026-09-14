import { z } from 'zod';

const proficiencyLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createProfileSchema = z.object({
  headline: z.string().max(255).optional(),
  bio: z.string().optional(),
  hourly_rate: z.number().nonnegative('Valor hora não pode ser negativo'),
  daily_rate: z.number().nonnegative('Valor diária não pode ser negativo').nullable().optional(),
  catalog_service_ids: z.array(z.number().int().positive()).max(30).optional(),
  availability_dates: z.array(z.string().regex(datePattern, 'Data inválida')).max(180).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().length(2).optional(),
  publish: z.boolean().optional(),
  skills: z.array(
    z.object({
      skill_id: z.number().int().positive(),
      proficiency_level: z.enum(proficiencyLevels).default('intermediate')
    })
  ).optional()
});

export const updateProfileSchema = createProfileSchema.partial();

export const updateAvailabilitySchema = z.object({
  availability_status: z.enum(['available', 'busy', 'offline'])
});
