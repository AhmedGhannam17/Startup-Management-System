import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { archiveClient } from '@/app/actions/clients-projects'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import type { Database } from '@/types/supabase'

export default async function ClientPage({
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
  const { data: clientData } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', context.organization.id)
    .maybeSingle()
  const client = clientData as unknown as Database['public']['Tables']['clients']['Row'] | null
  if (!client) notFound()
  const [{ data: privateDetailsData }, { data: projectsData }, query] = await Promise.all([
    context.isManager
      ? supabase
          .from('client_private_details')
          .select('tax_id,internal_notes')
          .eq('client_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('projects')
      .select('id,name,status')
      .eq('client_id', id)
      .eq('organization_id', context.organization.id)
      .order('created_at', { ascending: false }),
    searchParams,
  ])
  const privateDetails = privateDetailsData as unknown as
    Database['public']['Tables']['client_private_details']['Row'] | null
  const projects = projectsData as unknown as Array<
    Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'name' | 'status'>
  > | null
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {client.archived_at ? 'Archived client' : 'Active client'}
          </p>
        </div>
        <div className="flex gap-2">
          {context.isManager && (
            <>
              <Button asChild variant="outline">
                <Link href={`/clients/${id}/edit`}>Edit client</Link>
              </Button>
              <form action={archiveClient}>
                <input type="hidden" name="id" value={id} />
                <input
                  type="hidden"
                  name="archived"
                  value={client.archived_at ? 'true' : 'false'}
                />
                <Button variant="outline">{client.archived_at ? 'Restore' : 'Archive'}</Button>
              </form>
            </>
          )}
        </div>
      </div>
      {query.error && (
        <p role="alert" className="rounded bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ['Contact', client.contact_name],
            ['Email', client.email],
            ['Phone', client.phone],
            ['Website', client.website],
            ['Category', client.business_category],
            ['Address', client.address],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-muted-foreground">{k}</p>
              <p>{v || '—'}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      {context.isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Owner and manager details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Tax / business ID: {privateDetails?.tax_id || '—'}</p>
            <p className="whitespace-pre-wrap">
              {privateDetails?.internal_notes || 'No internal notes.'}
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects?.length ? (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link className="hover:underline" href={`/projects/${p.id}`}>
                    {p.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.status.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No projects for this client yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
