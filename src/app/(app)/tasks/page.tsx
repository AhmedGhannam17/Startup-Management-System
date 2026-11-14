import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { Button } from '@/components/ui/button'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { taskPriorities, taskStatuses } from '@/lib/validations/work-management'

function titleCase(value: string) {
  return value.replaceAll('_', ' ')
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    priority?: string
    view?: string
    error?: string
    page?: string
  }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const params = await searchParams
  const supabase = await createServerClient()
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  let query = supabase
    .from('tasks')
    .select('id,title,status,priority,due_date,assignee_id,project_id', { count: 'exact' })
    .eq('organization_id', context.organization.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .range((page - 1) * 50, page * 50 - 1)
  if (params.q) query = query.ilike('title', `%${params.q}%`)
  if (taskStatuses.includes(params.status as (typeof taskStatuses)[number]))
    query = query.eq('status', params.status as (typeof taskStatuses)[number])
  if (taskPriorities.includes(params.priority as (typeof taskPriorities)[number]))
    query = query.eq('priority', params.priority as (typeof taskPriorities)[number])
  if (params.view === 'mine') query = query.eq('assignee_id', context.membership.user_id)
  if (params.view === 'overdue')
    query = query.lt('due_date', new Date().toISOString().slice(0, 10)).neq('status', 'completed')
  const [{ data: tasks, count }, { data: projects }, { data: access }] = await Promise.all([
    query,
    supabase
      .from('projects')
      .select('id,created_by')
      .eq('organization_id', context.organization.id),
    supabase
      .from('project_members')
      .select('project_id,is_project_manager,can_manage_tasks')
      .eq('organization_id', context.organization.id)
      .eq('user_id', context.membership.user_id),
  ])
  const canCreateTask =
    context.isOwner ||
    (projects ?? []).some((project) => {
      const permission = (access ?? []).find((item) => item.project_id === project.id)
      return (
        (context.role === 'project_manager' && project.created_by === context.membership.user_id) ||
        permission?.is_project_manager ||
        permission?.can_manage_tasks
      )
    })
  const projectNames = new Map((projects ?? []).map((project) => [project.id, project.name]))
  const profileIds = [
    ...new Set(
      (tasks ?? []).map((task) => task.assignee_id).filter((id): id is string => Boolean(id))
    ),
  ]
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id,full_name').in('id', profileIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const filterParams = new URLSearchParams()
  if (params.q) filterParams.set('q', params.q)
  if (params.status) filterParams.set('status', params.status)
  if (params.priority) filterParams.set('priority', params.priority)
  if (params.view) filterParams.set('view', params.view)
  const pageHref = (value: number) => {
    const next = new URLSearchParams(filterParams)
    next.set('page', String(value))
    return `/tasks?${next.toString()}`
  }
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / 50))
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          title="Tasks"
          description="Keep project work, ownership, and deadlines visible."
        />
        {canCreateTask && (
          <Button asChild>
            <Link href="/tasks/new">Create task</Link>
          </Button>
        )}
      </div>
      {params.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      )}
      <form className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search tasks"
          className="field-input min-w-52 flex-1"
        />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="field-select w-auto min-w-36"
        >
          <option value="">All statuses</option>
          {taskStatuses.map((status) => (
            <option key={status} value={status}>
              {titleCase(status)}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={params.priority ?? ''}
          className="field-select w-auto min-w-32"
        >
          <option value="">All priorities</option>
          {taskPriorities.map((priority) => (
            <option key={priority}>{priority}</option>
          ))}
        </select>
        <select
          name="view"
          defaultValue={params.view ?? ''}
          className="field-select w-auto min-w-36"
        >
          <option value="">All visible tasks</option>
          <option value="mine">Assigned to me</option>
          <option value="overdue">Overdue</option>
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_140px_110px_150px] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground max-sm:hidden">
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due date</span>
        </div>
        {(tasks ?? []).map((task) => {
          const isOverdue =
            task.due_date &&
            task.due_date < new Date().toISOString().slice(0, 10) &&
            task.status !== 'completed'
          return (
            <div
              key={task.id}
              className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_140px_110px_150px] sm:items-center sm:gap-3"
            >
              <div className="min-w-0">
                <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                  {task.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {projectNames.get(task.project_id) ?? 'Project'} ·{' '}
                  {task.assignee_id ? names.get(task.assignee_id) || 'Team member' : 'Unassigned'}
                </p>
              </div>
              <span className="text-sm capitalize">{titleCase(task.status)}</span>
              <span className="text-sm capitalize">{task.priority}</span>
              <span
                className={
                  isOverdue
                    ? 'text-sm font-medium text-destructive'
                    : 'text-sm text-muted-foreground'
                }
              >
                {task.due_date ?? 'No due date'}
                {isOverdue ? ' · overdue' : ''}
              </span>
            </div>
          )
        })}
        {!tasks?.length && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No visible tasks match these filters.
          </p>
        )}
      </div>
      {pageCount > 1 && (
        <nav aria-label="Task pages" className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={pageHref(page - 1)}>Previous</Link>
              </Button>
            )}
            {page < pageCount && (
              <Button asChild variant="outline">
                <Link href={pageHref(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
