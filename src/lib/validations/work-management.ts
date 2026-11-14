import { z } from 'zod'

export const taskStatuses = ['todo', 'in_progress', 'completed', 'blocked'] as const
export const taskPriorities = ['low', 'medium', 'high', 'urgent'] as const
export const milestoneStatuses = ['not_started', 'in_progress', 'completed', 'on_hold'] as const

const dateField = z
  .string()
  .refine((value) => {
    if (!value) return true
    const date = new Date(`${value}T00:00:00Z`)
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value
    )
  }, 'Enter a valid date')
  .optional()
  .or(z.literal(''))

export const taskSchema = z.object({
  projectId: z.string().uuid('Choose a project'),
  milestoneId: z.string().uuid().optional().or(z.literal('')),
  assigneeId: z.string().uuid().optional().or(z.literal('')),
  title: z.string().trim().min(1, 'Task title is required').max(180),
  description: z.string().trim().max(10000).optional().or(z.literal('')),
  status: z.enum(taskStatuses),
  priority: z.enum(taskPriorities),
  dueDate: dateField,
})

export const milestoneSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, 'Milestone name is required').max(160),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  status: z.enum(milestoneStatuses),
  dueDate: dateField,
})

export const taskCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().min(1, 'Write a comment first').max(5000),
})

export const checklistItemSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1, 'Checklist item is required').max(300),
})
