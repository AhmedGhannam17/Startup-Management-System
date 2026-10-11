import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(160),
  contactName: optionalText(160),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .max(254)
    .optional()
    .or(z.literal('')),
  phone: optionalText(40),
  address: optionalText(500),
  website: z.string().trim().url('Enter a valid URL').max(2048).optional().or(z.literal('')),
  businessCategory: optionalText(120),
  taxId: optionalText(120),
  internalNotes: z.string().max(10000).optional().or(z.literal('')),
})

export const clientSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(120).optional(),
  archived: z.enum(['active', 'archived', 'all']).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
})

export type ClientInput = z.infer<typeof clientSchema>
