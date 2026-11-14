import { redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { QuotationForm } from '@/components/financial/quotation-form'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; clientId?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  if (!context.isManager)
    redirect('/quotations?error=Only Owners and Project Managers can manage quotations.')
  const [params, supabase] = await Promise.all([searchParams, createServerClient()])
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase
      .from('clients')
      .select('id,name')
      .eq('organization_id', context.organization.id)
      .is('archived_at', null)
      .order('name'),
    supabase
      .from('projects')
      .select('id,name,client_id')
      .eq('organization_id', context.organization.id)
      .order('name'),
  ])
  if (!clients?.length)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <SectionTitle title="Create quotation" description="A quotation needs an active client." />
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          Add a client before creating a quotation.
        </p>
        <div>
          <Button asChild>
            <Link href="/clients/new">Create client</Link>
          </Button>
        </div>
      </div>
    )
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionTitle
        title="Create quotation"
        description="Set the commercial terms and itemized pricing for a client."
      />
      <QuotationForm
        clients={clients ?? []}
        projects={projects ?? []}
        currency={context.organization.currency}
        defaultClientId={params.clientId}
        error={params.error}
      />
    </div>
  )
}
