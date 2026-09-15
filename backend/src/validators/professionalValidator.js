import { z } from 'zod';

const proficiencyLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createProfileSchema = z.object({
  display_name: z.string().trim().min(2).max(150).optional(),
  public_photo_url: z.union([z.literal(''), z.string().url().max(2048).regex(/^https?:\/\//)]).optional(),
  service_region: z.string().trim().min(2).max(500).optional(),
  billing_mode: z.enum(['hourly', 'daily', 'quote']).optional(),
  certifications: z.string().trim().max(5000).optional(),
  portfolio_urls: z.array(z.string().url().max(2048).regex(/^https?:\/\//)).max(12).optional(),
  headline: z.string().trim().max(255).optional(),
  bio: z.string().trim().max(5000).optional(),
  hourly_rate: z.number().max(99999999.99).nonnegative('Valor hora não pode ser negativo').optional(),
  daily_rate: z.number().max(99999999.99).nonnegative('Valor diária não pode ser negativo').nullable().optional(),
  catalog_service_ids: z.array(z.number().int().positive()).max(30).optional(),
  availability_dates: z.array(z.string().regex(datePattern, 'Data inválida').refine(value => { const date = new Date(value + 'T00:00:00Z'); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }, 'Data inválida')).max(180).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().toUpperCase().regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/).optional(),
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
