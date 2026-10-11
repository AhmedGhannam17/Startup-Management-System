import { z } from 'zod'

export const projectStatuses = [
  'planning',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const
export const projectPriorities = ['low', 'medium', 'high', 'urgent'] as const
export const projectVisibilities = ['organization', 'restricted'] as const

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))
const optionalUrl = (max: number) =>
  z.string().trim().url('Enter a valid URL').max(max).optional().or(z.literal(''))

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(180),
  description: optionalText(10000),
  projectType: optionalText(120),
  clientId: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(projectStatuses),
  priority: z.enum(projectPriorities),
  startDate: z.string().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
  visibility: z.enum(projectVisibilities),
  projectValue: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) =>
        value === undefined ||
        value === '' ||
        (/^\d{1,12}(\.\d{1,2})?$/.test(value) && Number(value) >= 0),
      {
        message: 'Enter a non-negative amount with up to two decimal places',
      }
    ),
  technologyStack: optionalText(2000),
  repositoryUrl: optionalUrl(2048),
  liveUrl: optionalUrl(2048),
  hostingProvider: optionalText(240),
  deploymentInformation: optionalText(5000),
  technicalNotes: optionalText(10000),
  internalNotes: optionalText(10000),
})

export const projectSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(projectStatuses).optional(),
  priority: z.enum(projectPriorities).optional(),
  visibility: z.enum(projectVisibilities).optional(),
  clientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
})

export const projectIdSchema = z.string().uuid('Invalid project')

export const projectMemberPermissionSchema = z.object({
  userId: z.string().uuid(),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canManageMembers: z.boolean(),
  canManageTasks: z.boolean(),
  canManageMilestones: z.boolean(),
  canEditInfo: z.boolean(),
  canAccessSensitive: z.boolean(),
  isProjectManager: z.boolean(),
})

export type ProjectInput = z.infer<typeof projectSchema>
