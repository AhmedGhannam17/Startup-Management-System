import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { SectionTitle } from '@/components/clients-projects/record-form'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; archived?: string; error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const params = await searchParams
  const supabase = await createServerClient()
  let query = supabase
    .from('clients')
    .select('id,name,contact_name,email,business_category,archived_at,created_at')
    .eq('organization_id', context.organization.id)
    .order('name')
  if (params.q) query = query.ilike('name', `%${params.q.replace(/[\\%_]/g, '\\$&')}%`)
  if (params.category) query = query.eq('business_category', params.category)
  if (params.archived === 'archived') query = query.not('archived_at', 'is', null)
  else if (params.archived !== 'all') query = query.is('archived_at', null)
  const [{ data: clients }, { data: categories }] = await Promise.all([
    query,
    supabase
      .from('clients')
      .select('business_category')
      .eq('organization_id', context.organization.id)
      .not('business_category', 'is', null),
  ])
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <SectionTitle title="Clients" description="Manage client records for this organization." />
        {context.isManager && (
          <Button asChild>
            <Link href="/clients/new">Add client</Link>
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
          placeholder="Search name or email"
          className="h-10 min-w-56 rounded-md border bg-background px-3 text-sm"
        />
        <select
          name="category"
          defaultValue={params.category ?? ''}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {[
            ...new Set(
              (categories ?? [])
                .map((c) => c.business_category)
                .filter((v): v is string => Boolean(v))
            ),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          name="archived"
          defaultValue={params.archived ?? 'active'}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All clients</option>
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3">Client</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Category</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">
                  <Link className="hover:underline" href={`/clients/${c.id}`}>
                    {c.name}
                  </Link>
                </td>
                <td className="p-3">{c.contact_name || c.email || '—'}</td>
                <td className="p-3">{c.business_category || '—'}</td>
                <td className="p-3">{c.archived_at ? 'Archived' : 'Active'}</td>
              </tr>
            ))}
            {!clients?.length && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  No clients match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
