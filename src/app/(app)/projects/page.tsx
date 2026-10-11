import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { projectStatuses, projectPriorities } from '@/lib/validations/project'
import type { Database } from '@/types/supabase'

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const params = await searchParams
  const supabase = await createServerClient()
  let query = supabase
    .from('projects')
    .select('id,name,status,priority,deadline,visibility,client_id,clients(name)')
    .eq('organization_id', context.organization.id)
    .order('created_at', { ascending: false })
  if (params.q) query = query.ilike('name', `%${params.q}%`)
  if (projectStatuses.includes(params.status as (typeof projectStatuses)[number]))
    query = query.eq('status', params.status as (typeof projectStatuses)[number])
  if (projectPriorities.includes(params.priority as (typeof projectPriorities)[number]))
    query = query.eq('priority', params.priority as (typeof projectPriorities)[number])
  const { data: projects } = await query
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <SectionTitle
          title="Projects"
          description="Track organization wide and restricted client work."
        />
        {context.isManager && (
          <Button asChild>
            <Link href="/projects/new">Create project</Link>
          </Button>
        )}
      </div>
      {params.error && (
        <p role="alert" className="rounded bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      )}
      <form className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search projects"
          className="h-10 min-w-56 rounded-md border bg-background px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {projectStatuses.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={params.priority ?? ''}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All priorities</option>
          {projectPriorities.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3">Project</th>
              <th className="p-3">Client</th>
              <th className="p-3">Status</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Deadline</th>
              <th className="p-3">Visibility</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => {
              const client = (
                p as unknown as Database['public']['Tables']['projects']['Row'] & {
                  clients: { name: string } | null
                }
              ).clients
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-medium">
                    <Link href={`/projects/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="p-3">{client?.name ?? '—'}</td>
                  <td className="p-3 capitalize">{p.status.replace('_', ' ')}</td>
                  <td className="p-3 capitalize">{p.priority}</td>
                  <td className="p-3">{p.deadline || '—'}</td>
                  <td className="p-3 capitalize">{p.visibility}</td>
                </tr>
              )
            })}
            {!projects?.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No visible projects match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
