import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  addChecklistItem,
  addTaskComment,
  deleteChecklistItem,
  deleteTask,
  deleteTaskComment,
  reorderTaskChecklistItem,
  toggleChecklistItem,
  updateTaskStatus,
} from '@/app/actions/work-management'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { ConfirmSubmitButton } from '@/components/financial/confirm-submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

function label(value: string) {
  return value.replaceAll('_', ' ')
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', context.organization.id)
    .eq('id', id)
    .maybeSingle()
  if (!task) notFound()
  const [
    { data: project },
    { data: milestone },
    { data: permission },
    { data: checklist },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('name,created_by')
      .eq('organization_id', context.organization.id)
      .eq('id', task.project_id)
      .maybeSingle(),
    task.milestone_id
      ? supabase
          .from('milestones')
          .select('name')
          .eq('organization_id', context.organization.id)
          .eq('id', task.milestone_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('project_members')
      .select('is_project_manager,can_manage_tasks')
      .eq('organization_id', context.organization.id)
      .eq('project_id', task.project_id)
      .eq('user_id', context.membership.user_id)
      .maybeSingle(),
    supabase
      .from('task_checklist_items')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('task_id', id)
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('task_comments')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('task_id', id)
      .order('created_at', { ascending: false }),
  ])
  const canManage = Boolean(
    context.isOwner ||
    (context.role === 'project_manager' && project?.created_by === context.membership.user_id) ||
    permission?.is_project_manager ||
    permission?.can_manage_tasks
  )
  const isAssignee = task.assignee_id === context.membership.user_id
  const profileIds = [
    ...new Set(
      [task.assignee_id, ...(comments ?? []).map((comment) => comment.author_id)].filter(
        (personId): personId is string => Boolean(personId)
      )
    ),
  ]
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id,full_name').in('id', profileIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const completeCount = (checklist ?? []).filter((item) => item.is_completed).length
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle
          title={task.title}
          description={`${project?.name ?? 'Project'}${milestone ? ` · ${milestone.name}` : ''}`}
        />
        {canManage && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/tasks/${id}/edit`}>Edit task</Link>
            </Button>
            <form action={deleteTask}>
              <input type="hidden" name="taskId" value={id} />
              <ConfirmSubmitButton
                type="submit"
                variant="destructive"
                confirmation="Delete this task and its checklist and comments?"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </div>
        )}
      </div>
      {query.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Task details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="capitalize">{label(task.status)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Priority</span>
              <span className="capitalize">{task.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due</span>
              <span>{task.due_date ?? 'No due date'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Assigned to</span>
              <span>
                {task.assignee_id ? names.get(task.assignee_id) || 'Team member' : 'Unassigned'}
              </span>
            </div>
            {task.description && (
              <p className="whitespace-pre-wrap border-t pt-3">{task.description}</p>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Update progress</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage || isAssignee ? (
              <form action={updateTaskStatus} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="taskId" value={id} />
                <select
                  name="status"
                  defaultValue={task.status}
                  className="field-select w-auto min-w-40"
                >
                  {(['todo', 'in_progress', 'blocked', 'completed'] as const).map((status) => (
                    <option key={status} value={status}>
                      {label(status)}
                    </option>
                  ))}
                </select>
                <Button variant="outline">Save status</Button>
                {task.completed_at && (
                  <span className="text-xs text-muted-foreground">
                    Completed {new Date(task.completed_at).toLocaleDateString()}
                  </span>
                )}
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only the assignee or a task manager can update task status.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Checklist{' '}
              <span className="text-sm font-normal text-muted-foreground">
                {completeCount}/{checklist?.length ?? 0} complete
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(checklist ?? []).length ? (
              <ul className="space-y-3">
                {checklist?.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b pb-3 last:border-0"
                  >
                    <form action={toggleChecklistItem} className="flex min-w-0 items-center gap-3">
                      <input type="hidden" name="taskId" value={id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        aria-label={`${item.is_completed ? 'Reopen' : 'Complete'} ${item.title}`}
                        className="h-5 w-5 shrink-0 rounded border text-xs"
                      >
                        {item.is_completed ? '✓' : ''}
                      </button>
                      <span
                        className={
                          item.is_completed
                            ? 'text-sm text-muted-foreground line-through'
                            : 'text-sm'
                        }
                      >
                        {item.title}
                      </span>
                    </form>
                    <div className="flex items-center gap-1">
                      {canManage && (
                        <>
                          <form action={reorderTaskChecklistItem}>
                            <input type="hidden" name="taskId" value={id} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="direction" value="-1" />
                            <button
                              type="submit"
                              disabled={index === 0}
                              aria-label={`Move ${item.title} up`}
                              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-30"
                            >
                              ↑
                            </button>
                          </form>
                          <form action={reorderTaskChecklistItem}>
                            <input type="hidden" name="taskId" value={id} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="direction" value="1" />
                            <button
                              type="submit"
                              disabled={index === (checklist?.length ?? 1) - 1}
                              aria-label={`Move ${item.title} down`}
                              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-30"
                            >
                              ↓
                            </button>
                          </form>
                          <form action={deleteChecklistItem}>
                            <input type="hidden" name="taskId" value={id} />
                            <input type="hidden" name="itemId" value={item.id} />
                            <button
                              type="submit"
                              className="px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                            >
                              Remove
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No checklist items yet.</p>
            )}
            {canManage && (
              <form action={addChecklistItem} className="flex gap-2 border-t pt-4">
                <input type="hidden" name="taskId" value={id} />
                <input
                  name="title"
                  required
                  maxLength={300}
                  placeholder="Add a checklist item"
                  className="field-input"
                />
                <Button>Add</Button>
              </form>
            )}
            {!canManage && (
              <p className="text-xs text-muted-foreground">
                The assignee can mark checklist items complete.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Discussion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={addTaskComment} className="space-y-2">
              <input type="hidden" name="taskId" value={id} />
              <textarea
                name="body"
                required
                maxLength={5000}
                rows={3}
                placeholder="Write a project update or question"
                className="field-input"
              />
              <div className="text-right">
                <Button>Post comment</Button>
              </div>
            </form>
            {(comments ?? []).length ? (
              <ul className="space-y-4 border-t pt-4">
                {comments?.map((comment) => (
                  <li key={comment.id} className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>{names.get(comment.author_id) || 'Team member'}</span>
                      <time dateTime={comment.created_at}>
                        {new Date(comment.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                    {(comment.author_id === context.membership.user_id || canManage) && (
                      <form action={deleteTaskComment}>
                        <input type="hidden" name="taskId" value={id} />
                        <input type="hidden" name="commentId" value={comment.id} />
                        <button className="text-xs text-muted-foreground hover:text-destructive">
                          Delete comment
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t pt-4 text-sm text-muted-foreground">No comments yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
