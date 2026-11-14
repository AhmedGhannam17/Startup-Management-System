'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { getUserFriendlyDatabaseError } from '@/lib/errors'
import { createServerClient } from '@/lib/supabase/server'
import {
  checklistItemSchema,
  milestoneSchema,
  taskCommentSchema,
  taskSchema,
  taskStatuses,
} from '@/lib/validations/work-management'

function field(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

async function canManageTasks(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  context: NonNullable<Awaited<ReturnType<typeof getActiveOrganizationContext>>>,
  projectId: string
) {
  if (context.isOwner) return true
  const [{ data: project }, { data: access }] = await Promise.all([
    supabase
      .from('projects')
      .select('id,created_by')
      .eq('organization_id', context.organization.id)
      .eq('id', projectId)
      .maybeSingle(),
    supabase
      .from('project_members')
      .select('is_project_manager,can_manage_tasks')
      .eq('organization_id', context.organization.id)
      .eq('project_id', projectId)
      .eq('user_id', context.membership.user_id)
      .maybeSingle(),
  ])
  return Boolean(
    (context.role === 'project_manager' && project?.created_by === context.membership.user_id) ||
    access?.is_project_manager ||
    access?.can_manage_tasks
  )
}

async function canManageMilestones(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  context: NonNullable<Awaited<ReturnType<typeof getActiveOrganizationContext>>>,
  projectId: string
) {
  if (context.isOwner) return true
  const [{ data: project }, { data: access }] = await Promise.all([
    supabase
      .from('projects')
      .select('id,created_by')
      .eq('organization_id', context.organization.id)
      .eq('id', projectId)
      .maybeSingle(),
    supabase
      .from('project_members')
      .select('is_project_manager,can_manage_milestones')
      .eq('organization_id', context.organization.id)
      .eq('project_id', projectId)
      .eq('user_id', context.membership.user_id)
      .maybeSingle(),
  ])
  return Boolean(
    (context.role === 'project_manager' && project?.created_by === context.membership.user_id) ||
    access?.is_project_manager ||
    access?.can_manage_milestones
  )
}

async function assigneeCanViewProject(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  context: NonNullable<Awaited<ReturnType<typeof getActiveOrganizationContext>>>,
  projectId: string,
  assigneeId: string
) {
  const [{ data: project }, { data: member }] = await Promise.all([
    supabase
      .from('projects')
      .select('id,visibility')
      .eq('organization_id', context.organization.id)
      .eq('id', projectId)
      .maybeSingle(),
    supabase
      .from('organization_members')
      .select('user_id,role')
      .eq('organization_id', context.organization.id)
      .eq('user_id', assigneeId)
      .maybeSingle(),
  ])
  if (!project || !member) return false
  if (project.visibility === 'organization' || member.role === 'owner') return true

  const { data: projectMember } = await supabase
    .from('project_members')
    .select('can_view')
    .eq('organization_id', context.organization.id)
    .eq('project_id', projectId)
    .eq('user_id', assigneeId)
    .maybeSingle()
  return projectMember?.can_view === true
}

export async function saveTask(form: FormData) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/tasks?error=forbidden')
  const id = field(form, 'id')
  const parsed = taskSchema.safeParse({
    projectId: field(form, 'projectId'),
    milestoneId: field(form, 'milestoneId'),
    assigneeId: field(form, 'assigneeId'),
    title: field(form, 'title'),
    description: field(form, 'description'),
    status: field(form, 'status'),
    priority: field(form, 'priority'),
    dueDate: field(form, 'dueDate'),
  })
  if (!parsed.success)
    redirect(
      `${id ? `/tasks/${id}/edit` : '/tasks/new'}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Review the task fields')}`
    )

  const supabase = await createServerClient()
  if (!(await canManageTasks(supabase, context, parsed.data.projectId)))
    redirect('/tasks?error=You do not have permission to manage tasks for that project.')
  if (parsed.data.milestoneId) {
    const { data: milestone } = await supabase
      .from('milestones')
      .select('id')
      .eq('organization_id', context.organization.id)
      .eq('project_id', parsed.data.projectId)
      .eq('id', parsed.data.milestoneId)
      .maybeSingle()
    if (!milestone)
      redirect(
        `${id ? `/tasks/${id}/edit` : '/tasks/new'}?error=Choose a milestone from this project.`
      )
  }
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) redirect('/tasks?error=That task could not be found.')
  if (id) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('organization_id', context.organization.id)
      .eq('project_id', parsed.data.projectId)
      .eq('id', id)
      .maybeSingle()
    if (!existing) redirect('/tasks?error=That task could not be found in this project.')
  }
  if (
    parsed.data.assigneeId &&
    !(await assigneeCanViewProject(
      supabase,
      context,
      parsed.data.projectId,
      parsed.data.assigneeId
    ))
  )
    redirect(
      `${id ? `/tasks/${id}/edit` : '/tasks/new'}?error=Choose a team member who can access this project.`
    )

  const payload = {
    project_id: parsed.data.projectId,
    milestone_id: parsed.data.milestoneId || null,
    assignee_id: parsed.data.assigneeId || null,
    title: parsed.data.title,
    description: parsed.data.description || null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_date: parsed.data.dueDate || null,
  }

  let taskId = id
  if (id) {
    const { error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .eq('project_id', parsed.data.projectId)
      .eq('organization_id', context.organization.id)
    if (error)
      redirect(`/tasks/${id}/edit?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  } else {
    taskId = randomUUID()
    const { error } = await supabase.from('tasks').insert({
      ...payload,
      id: taskId,
      organization_id: context.organization.id,
      created_by: context.membership.user_id,
    })
    if (error)
      redirect(`/tasks/new?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  }
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath(`/projects/${parsed.data.projectId}`)
  redirect(`/tasks/${taskId}`)
}

export async function updateTaskStatus(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'taskId')
  const status = field(form, 'status')
  if (!context || !taskStatuses.includes(status as (typeof taskStatuses)[number]))
    redirect('/tasks?error=Invalid task status')
  const supabase = await createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('id,project_id,assignee_id')
    .eq('organization_id', context.organization.id)
    .eq('id', id)
    .maybeSingle()
  if (!task) redirect('/tasks?error=Task not found')
  const canManage = await canManageTasks(supabase, context, task.project_id)
  if (!canManage && task.assignee_id !== context.membership.user_id)
    redirect(`/tasks/${id}?error=You do not have permission to update this task.`)
  const { error } = await supabase
    .from('tasks')
    .update({ status: status as (typeof taskStatuses)[number] })
    .eq('organization_id', context.organization.id)
    .eq('id', id)
  if (error)
    redirect(`/tasks/${id}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${id}`)
  revalidatePath(`/projects/${task.project_id}`)
  redirect(`/tasks/${id}`)
}

export async function deleteTask(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'taskId')
  if (!context) redirect('/tasks?error=forbidden')
  const supabase = await createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('organization_id', context.organization.id)
    .eq('id', id)
    .maybeSingle()
  if (!task || !(await canManageTasks(supabase, context, task.project_id)))
    redirect('/tasks?error=You do not have permission to delete this task.')
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('organization_id', context.organization.id)
    .eq('id', id)
  if (error)
    redirect(`/tasks/${id}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  revalidatePath('/tasks')
  revalidatePath(`/projects/${task.project_id}`)
  redirect('/tasks')
}

export async function saveMilestone(form: FormData) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/projects?error=forbidden')
  const id = field(form, 'id')
  const parsed = milestoneSchema.safeParse({
    projectId: field(form, 'projectId'),
    name: field(form, 'name'),
    description: field(form, 'description'),
    status: field(form, 'status'),
    dueDate: field(form, 'dueDate'),
  })
  const fallback = id ? `/projects/${field(form, 'projectId')}` : '/projects'
  if (!parsed.success)
    redirect(
      `${fallback}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Review the milestone fields')}`
    )
  const supabase = await createServerClient()
  if (!(await canManageMilestones(supabase, context, parsed.data.projectId)))
    redirect(`${fallback}?error=You do not have permission to manage milestones for this project.`)
  const values = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    status: parsed.data.status,
    due_date: parsed.data.dueDate || null,
  }
  if (id) {
    const { error } = await supabase
      .from('milestones')
      .update(values)
      .eq('organization_id', context.organization.id)
      .eq('project_id', parsed.data.projectId)
      .eq('id', id)
    if (error)
      redirect(`${fallback}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  } else {
    const { error } = await supabase.from('milestones').insert({
      ...values,
      organization_id: context.organization.id,
      project_id: parsed.data.projectId,
      created_by: context.membership.user_id,
    })
    if (error)
      redirect(`${fallback}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  }
  revalidatePath(`/projects/${parsed.data.projectId}`)
  revalidatePath('/tasks')
  redirect(`/projects/${parsed.data.projectId}`)
}

export async function deleteMilestone(form: FormData) {
  const context = await getActiveOrganizationContext()
  const projectId = field(form, 'projectId')
  const milestoneId = field(form, 'milestoneId')
  if (!context) redirect('/projects')
  const supabase = await createServerClient()
  if (!(await canManageMilestones(supabase, context, projectId)))
    redirect(`/projects/${projectId}?error=You do not have permission to delete milestones.`)
  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('organization_id', context.organization.id)
    .eq('project_id', projectId)
    .eq('id', milestoneId)
  if (error)
    redirect(
      `/projects/${projectId}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`
    )
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/tasks')
  redirect(`/projects/${projectId}`)
}

export async function addChecklistItem(form: FormData) {
  const context = await getActiveOrganizationContext()
  const parsed = checklistItemSchema.safeParse({
    taskId: field(form, 'taskId'),
    title: field(form, 'title'),
  })
  if (!context || !parsed.success) redirect('/tasks?error=Enter a checklist item')
  const supabase = await createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('organization_id', context.organization.id)
    .eq('id', parsed.data.taskId)
    .maybeSingle()
  if (!task || !(await canManageTasks(supabase, context, task.project_id)))
    redirect(
      `/tasks/${parsed.data.taskId}?error=You do not have permission to add checklist items.`
    )
  const { data: items } = await supabase
    .from('task_checklist_items')
    .select('sort_order')
    .eq('organization_id', context.organization.id)
    .eq('task_id', parsed.data.taskId)
  const nextOrder = Math.max(-1, ...(items ?? []).map((item) => item.sort_order)) + 1
  const { error } = await supabase.from('task_checklist_items').insert({
    organization_id: context.organization.id,
    task_id: parsed.data.taskId,
    title: parsed.data.title,
    sort_order: nextOrder,
    created_by: context.membership.user_id,
  })
  if (error)
    redirect(
      `/tasks/${parsed.data.taskId}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`
    )
  revalidatePath(`/tasks/${parsed.data.taskId}`)
  redirect(`/tasks/${parsed.data.taskId}`)
}

export async function toggleChecklistItem(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'itemId')
  const taskId = field(form, 'taskId')
  if (!context) redirect('/tasks')
  const supabase = await createServerClient()
  const { data: item } = await supabase
    .from('task_checklist_items')
    .select('is_completed')
    .eq('organization_id', context.organization.id)
    .eq('task_id', taskId)
    .eq('id', id)
    .maybeSingle()
  if (!item) redirect('/tasks?error=Checklist item not found')
  const { error } = await supabase
    .from('task_checklist_items')
    .update({ is_completed: !item.is_completed })
    .eq('organization_id', context.organization.id)
    .eq('task_id', taskId)
    .eq('id', id)
  if (error)
    redirect(`/tasks/${taskId}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath('/tasks')
  redirect(`/tasks/${taskId}`)
}

export async function deleteChecklistItem(form: FormData) {
  const context = await getActiveOrganizationContext()
  const itemId = field(form, 'itemId')
  const taskId = field(form, 'taskId')
  if (!context) redirect('/tasks')
  const supabase = await createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('organization_id', context.organization.id)
    .eq('id', taskId)
    .maybeSingle()
  if (!task || !(await canManageTasks(supabase, context, task.project_id)))
    redirect(`/tasks/${taskId}?error=You do not have permission to remove checklist items.`)
  const { error } = await supabase
    .from('task_checklist_items')
    .delete()
    .eq('organization_id', context.organization.id)
    .eq('task_id', taskId)
    .eq('id', itemId)
  if (error)
    redirect(`/tasks/${taskId}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  revalidatePath(`/tasks/${taskId}`)
  redirect(`/tasks/${taskId}`)
}

export async function reorderTaskChecklistItem(form: FormData) {
  const context = await getActiveOrganizationContext()
  const taskId = field(form, 'taskId')
  const itemId = field(form, 'itemId')
  const direction = field(form, 'direction')
  if (!context || !['-1', '1'].includes(direction))
    redirect('/tasks?error=Choose a valid checklist position.')
  const supabase = await createServerClient()
  const { error } = await supabase.rpc('reorder_task_checklist_item', {
    p_organization_id: context.organization.id,
    p_task_id: taskId,
    p_item_id: itemId,
    p_direction: Number(direction),
  })
  if (error)
    redirect(`/tasks/${taskId}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  revalidatePath(`/tasks/${taskId}`)
  redirect(`/tasks/${taskId}`)
}

export async function addTaskComment(form: FormData) {
  const context = await getActiveOrganizationContext()
  const parsed = taskCommentSchema.safeParse({
    taskId: field(form, 'taskId'),
    body: field(form, 'body'),
  })
  if (!context || !parsed.success) redirect('/tasks?error=Write a comment before posting')
  const supabase = await createServerClient()
  const { error } = await supabase.from('task_comments').insert({
    organization_id: context.organization.id,
    task_id: parsed.data.taskId,
    author_id: context.membership.user_id,
    body: parsed.data.body,
  })
  if (error)
    redirect(
      `/tasks/${parsed.data.taskId}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`
    )
  revalidatePath(`/tasks/${parsed.data.taskId}`)
  redirect(`/tasks/${parsed.data.taskId}`)
}

export async function deleteTaskComment(form: FormData) {
  const context = await getActiveOrganizationContext()
  const taskId = field(form, 'taskId')
  const commentId = field(form, 'commentId')
  if (!context) redirect('/tasks')
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('task_comments')
    .delete()
    .eq('organization_id', context.organization.id)
    .eq('task_id', taskId)
    .eq('id', commentId)
  if (error)
    redirect(`/tasks/${taskId}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  revalidatePath(`/tasks/${taskId}`)
  redirect(`/tasks/${taskId}`)
}
