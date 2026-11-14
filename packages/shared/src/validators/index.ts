import { z } from 'zod'

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const workspaceIdSchema = z.object({
  workspaceId: z.string().min(1),
})

export const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only')

export const emailSchema = z.string().email().toLowerCase().trim()

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
  .optional()
