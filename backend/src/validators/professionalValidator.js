import { z } from 'zod';

const proficiencyLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

export const createProfileSchema = z.object({
  headline: z.string().max(255).optional(),
  bio: z.string().optional(),
  hourly_rate: z.number().nonnegative('Valor hora não pode ser negativo'),
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