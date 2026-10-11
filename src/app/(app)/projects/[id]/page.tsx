import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { saveProjectMembers } from '@/app/actions/clients-projects'
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
  const [{ data: p }, { data: details }, { data: members }, { error }] = await Promise.all([
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
    ]),
  ]
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id,full_name').in('id', profileIds)
    : { data: [] }
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const { data: mine } = await supabase
    .from('project_members')
    .select('is_project_manager,can_manage_members')
    .eq('project_id', id)
    .eq('user_id', context.membership.user_id)
    .maybeSingle()
  const canManage =
    context.isOwner ||
    (context.role === 'project_manager' && p.created_by === context.membership.user_id) ||
    mine?.is_project_manager ||
    mine?.can_manage_members
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
