import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { saveProjectMembers } from '@/app/actions/clients-projects'
import { MilestoneForm, type MilestoneFormValue } from '@/components/work-management/milestone-form'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import type { Database } from '@/types/supabase'

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const { id } = await params
  const supabase = await createServerClient()
  const [
    { data: p },
    { data: details },
    { data: members },
    { error },
    { data: milestones },
    { data: tasks },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('*,clients(name)')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .maybeSingle(),
    supabase.from('project_private_details').select('*').eq('project_id', id).maybeSingle(),
    supabase
      .from('project_members')
      .select(
        'user_id,is_project_manager,can_view,can_edit,can_manage_members,can_manage_tasks,can_manage_milestones,can_edit_info,can_access_sensitive'
      )
      .eq('project_id', id)
      .eq('organization_id', context.organization.id),
    searchParams,
    supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id)
      .eq('organization_id', context.organization.id)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('tasks')
      .select('id,title,status,priority,due_date,assignee_id,milestone_id')
      .eq('project_id', id)
      .eq('organization_id', context.organization.id)
      .order('created_at', { ascending: false }),
    context.isManager
      ? supabase.rpc('get_payment_totals', {
          p_organization_id: context.organization.id,
          p_client_id: null,
          p_project_id: id,
          p_quotation_id: null,
        })
      : Promise.resolve({ data: [] }),
  ])
  if (!p) notFound()
  const { data: people } = await supabase
    .from('organization_members')
    .select('user_id,role')
    .eq('organization_id', context.organization.id)
  const profileIds = [
    ...new Set([
      ...(people ?? []).map((person) => person.user_id),
      ...(members ?? []).map((member) => member.user_id),
      ...(tasks ?? [])
        .map((task) => task.assignee_id)
        .filter((userId): userId is string => Boolean(userId)),
    ]),
  ]
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id,full_name').in('id', profileIds)
    : { data: [] }
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const { data: mine } = await supabase
    .from('project_members')
    .select('is_project_manager,can_manage_members,can_manage_tasks,can_manage_milestones')
    .eq('project_id', id)
    .eq('user_id', context.membership.user_id)
    .maybeSingle()
  const canManage =
    context.isOwner ||
    (context.role === 'project_manager' && p.created_by === context.membership.user_id) ||
    mine?.is_project_manager ||
    mine?.can_manage_members
  const canManageTasks =
    context.isOwner ||
    (context.role === 'project_manager' && p.created_by === context.membership.user_id) ||
    mine?.is_project_manager ||
    mine?.can_manage_tasks
  const canManageMilestones =
    context.isOwner ||
    (context.role === 'project_manager' && p.created_by === context.membership.user_id) ||
    mine?.is_project_manager ||
    mine?.can_manage_milestones
  const projectPayments = (payments ?? []).filter(
    (payment) => payment.currency === context.organization.currency
  )
  const client = (
    p as unknown as Database['public']['Tables']['projects']['Row'] & {
      clients: { name: string } | null
    }
  ).clients
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <SectionTitle
          title={p.name}
          description={`${client?.name ?? 'No client'} · ${p.visibility} visibility`}
        />
        <Button asChild variant="outline">
          <Link href={`/projects/${id}/edit`}>Edit project</Link>
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project overview</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              Status <p className="font-medium capitalize">{p.status.replace('_', ' ')}</p>
            </div>
            <div>
              Priority <p className="font-medium capitalize">{p.priority}</p>
            </div>
            <div>
              Start date <p className="font-medium">{p.start_date || '—'}</p>
            </div>
            <div>
              Deadline <p className="font-medium">{p.deadline || '—'}</p>
            </div>
            <div>
              Type <p className="font-medium">{p.project_type || '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">
            {p.description || 'No description provided.'}
          </CardContent>
        </Card>
      </div>
      {context.isManager && details?.project_value != null && (
        <Card>
          <CardHeader>
            <CardTitle>Project financial summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Project value</p>
              <p className="font-semibold">
                {context.organization.currency} {Number(details.project_value).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Payments received</p>
              <p className="font-semibold">
                {context.organization.currency}{' '}
                {projectPayments
                  .reduce((sum, payment) => sum + Number(payment.total_received), 0)
                  .toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-semibold">
                {context.organization.currency}{' '}
                {Math.max(
                  0,
                  Number(details.project_value) -
                    projectPayments.reduce(
                      (sum, payment) => sum + Number(payment.total_received),
                      0
                    )
                ).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Milestones</CardTitle>
          {canManageMilestones && (
            <span className="text-xs text-muted-foreground">
              Milestone progress is derived from its tasks.
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {(milestones ?? []).length ? (
            <div className="space-y-3">
              {milestones?.map((milestone) => {
                const milestoneTasks = (tasks ?? []).filter(
                  (task) => task.milestone_id === milestone.id
                )
                const done = milestoneTasks.filter((task) => task.status === 'completed').length
                const percent = milestoneTasks.length
                  ? Math.round((done / milestoneTasks.length) * 100)
                  : 0
                return (
                  <div key={milestone.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-medium">{milestone.name}</p>
                        {milestone.description && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {milestone.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm capitalize text-muted-foreground">
                        {milestone.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full rounded bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span>
                        {done}/{milestoneTasks.length} tasks · {percent}%
                      </span>
                      {milestone.due_date && <span>Due {milestone.due_date}</span>}
                    </div>
                    {canManageMilestones && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium">
                          Edit milestone
                        </summary>
                        <div className="mt-2">
                          <MilestoneForm
                            projectId={id}
                            milestone={milestone as MilestoneFormValue}
                          />
                        </div>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No milestones for this project yet.</p>
          )}
          {canManageMilestones && (
            <details className="rounded-md border border-dashed p-3">
              <summary className="cursor-pointer text-sm font-medium">Add a milestone</summary>
              <div className="mt-3">
                <MilestoneForm projectId={id} />
              </div>
            </details>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Project tasks</CardTitle>
          {canManageTasks && (
            <Button asChild size="sm">
              <Link href={`/tasks/new?projectId=${id}`}>Add task</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {(tasks ?? []).length ? (
            <ul className="divide-y">
              {tasks?.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                      {task.title}
                    </Link>
                    <p className="text-xs capitalize text-muted-foreground">
                      {task.priority} priority{task.due_date ? ` · due ${task.due_date}` : ''}
                      {task.assignee_id
                        ? ` · ${profileById.get(task.assignee_id) || 'Assigned'}`
                        : ' · Unassigned'}
                    </p>
                  </div>
                  <span className="text-sm capitalize text-muted-foreground">
                    {task.status.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tasks have been added to this project.
            </p>
          )}
        </CardContent>
      </Card>
      {details && (
        <Card>
          <CardHeader>
            <CardTitle>Technical and internal information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              [
                'Value',
                details.project_value == null
                  ? '—'
                  : `${context.organization.currency} ${details.project_value}`,
              ],
              ['Technology', details.technology_stack],
              ['Repository', details.repository_url],
              ['Live site', details.live_url],
              ['Hosting', details.hosting_provider],
              ['Deployment', details.deployment_information],
              ['Technical notes', details.technical_notes],
              ['Internal notes', details.internal_notes],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-muted-foreground">{label}</p>
                <p className="whitespace-pre-wrap">{value || '—'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Project team and access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex justify-between border-b pb-2">
                <span>
                  {profileById.get(m.user_id) || 'Organization member'}
                  {m.is_project_manager && ' · Project Manager'}
                </span>
                <span className="text-muted-foreground">
                  {[
                    m.can_edit && 'edit',
                    m.can_manage_tasks && 'tasks',
                    m.can_manage_milestones && 'milestones',
                    m.can_access_sensitive && 'sensitive',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'view'}
                </span>
              </li>
            ))}
          </ul>
          {canManage && (
            <details className="rounded border p-4">
              <summary className="cursor-pointer font-medium">
                Manage assigned members and permissions
              </summary>
              <form action={saveProjectMembers} className="mt-4 space-y-4">
                <input type="hidden" name="projectId" value={id} />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="managerId"
                    value=""
                    defaultChecked={!(members ?? []).some((member) => member.is_project_manager)}
                  />
                  No project manager
                </label>
                {(people ?? []).map((person) => {
                  const m = (members ?? []).find((x) => x.user_id === person.user_id)
                  return (
                    <fieldset key={person.user_id} className="space-y-2 border-b pb-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="userId"
                          value={person.user_id}
                          defaultChecked={Boolean(m)}
                        />
                        {profileById.get(person.user_id) || 'Member'}{' '}
                        <span className="text-muted-foreground">
                          ({person.role.replace('_', ' ')})
                        </span>
                      </label>
                      {person.role === 'project_manager' && (
                        <label className="ml-6 block text-xs">
                          <input
                            type="radio"
                            name="managerId"
                            value={person.user_id}
                            defaultChecked={m?.is_project_manager}
                          />{' '}
                          Project Manager
                        </label>
                      )}
                      <div className="ml-6 flex flex-wrap gap-3 text-xs">
                        {(
                          [
                            ['view', 'View', m?.can_view],
                            ['edit', 'Edit', m?.can_edit],
                            ['members', 'Manage members', m?.can_manage_members],
                            ['tasks', 'Manage tasks', m?.can_manage_tasks],
                            ['milestones', 'Manage milestones', m?.can_manage_milestones],
                            ['info', 'Edit project info', m?.can_edit_info],
                            ['sensitive', 'View sensitive info', m?.can_access_sensitive],
                          ] as const
                        ).map(([key, label, checked]) => (
                          <label key={key} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              name={`${key}:${person.user_id}`}
                              defaultChecked={Boolean(checked)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )
                })}
                <Button type="submit">Save access</Button>
              </form>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
