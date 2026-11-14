import { z } from 'zod'
import type { PaymentMethod, QuotationTemplate } from '@/types/supabase'

export const quotationTemplates = ['classic', 'modern', 'minimal'] as const
export const quotationStatuses = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'void',
] as const
export const paymentMethods = ['cash', 'bank_transfer', 'upi', 'card', 'other'] as const

const dateValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }, 'Enter a valid date')

const quotationLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive().max(1000000),
  unit_price: z.number().min(0).max(999999999999),
  discount_percent: z.number().min(0).max(100),
  tax_percent: z.number().min(0).max(100),
  sort_order: z.number().int().min(0),
})

export const quotationSchema = z
  .object({
    clientId: z.string().uuid('Select a client'),
    projectId: z.string().uuid().optional().or(z.literal('')),
    title: z.string().trim().min(1, 'Quotation title is required').max(180),
    description: z.string().trim().max(5000).optional().or(z.literal('')),
    template: z.enum(quotationTemplates),
    issueDate: dateValue,
    validUntil: dateValue.optional().or(z.literal('')),
    paymentTerms: z.string().trim().max(3000).optional().or(z.literal('')),
    termsAndConditions: z.string().trim().max(10000).optional().or(z.literal('')),
    notes: z.string().trim().max(5000).optional().or(z.literal('')),
    signatoryName: z.string().trim().max(160).optional().or(z.literal('')),
    signatoryTitle: z.string().trim().max(160).optional().or(z.literal('')),
    lineItems: z.array(quotationLineSchema).min(1, 'Add at least one quotation item').max(100),
  })
  .refine((value) => !value.validUntil || value.validUntil >= value.issueDate, {
    message: 'The validity date must be on or after the issue date',
    path: ['validUntil'],
  })

export const paymentSchema = z.object({
  clientId: z.string().uuid('Select a client'),
  projectId: z.string().uuid().optional().or(z.literal('')),
  quotationId: z.string().uuid().optional().or(z.literal('')),
  amount: z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Enter an amount with up to two decimal places')
    .refine((value) => Number(value) > 0, 'Payment amount must be greater than zero'),
  paidOn: dateValue,
  method: z.enum(paymentMethods),
  reference: z.string().trim().max(240).optional().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
})

export type QuotationInput = z.infer<typeof quotationSchema> & { template: QuotationTemplate }
export type PaymentInput = z.infer<typeof paymentSchema> & { method: PaymentMethod }
