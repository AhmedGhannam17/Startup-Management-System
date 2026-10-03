import { z } from 'zod'

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be under 100 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(30, 'Phone number is too long').optional().or(z.literal('')),
  address: z.string().max(200, 'Address is too long').optional().or(z.literal('')),
  website: z
    .string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),
  businessDescription: z
    .string()
    .max(500, 'Description is too long')
    .optional()
    .or(z.literal('')),
  taxId: z.string().max(50, 'Tax ID is too long').optional().or(z.literal('')),
  currency: z.string().min(3, 'Currency code required').max(3, 'Use 3-letter code (e.g. USD)'),
})

export const updateOrganizationSchema = createOrganizationSchema

export const inviteMemberSchema = z.object({
  recipientName: z.string().max(100, 'Name is too long').optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['owner', 'project_manager', 'employee'], {
    required_error: 'Role is required',
  }),
})

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  role: z.enum(['owner', 'project_manager', 'employee']),
})

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
