import { redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { PaymentForm } from '@/components/financial/payment-form'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    clientId?: string
    projectId?: string
    quotationId?: string
  }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  if (!context.isManager)
    redirect('/payments?error=Only Owners and Project Managers can manage payments.')
  const [params, supabase] = await Promise.all([searchParams, createServerClient()])
  const [{ data: clients }, { data: projects }, { data: quotations }] = await Promise.all([
    supabase
      .from('clients')
      .select('id,name')
      .eq('organization_id', context.organization.id)
      .order('name'),
    supabase
      .from('projects')
      .select('id,name,client_id')
      .eq('organization_id', context.organization.id)
      .order('name'),
    supabase
      .from('quotations')
      .select('id,quote_number,title,client_id,currency')
      .eq('organization_id', context.organization.id)
      .order('issue_date', { ascending: false }),
  ])
  if (!clients?.length)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <SectionTitle title="Record payment" description="A payment needs a client." />
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          Add a client before recording a payment.
        </p>
        <div>
          <Button asChild>
            <Link href="/clients/new">Create client</Link>
          </Button>
        </div>
      </div>
    )
  const selectedCurrency =
    quotations?.find((quotation) => quotation.id === params.quotationId)?.currency ??
    context.organization.currency
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle
        title="Record payment"
        description={`Record funds received in ${selectedCurrency}.`}
      />
      <PaymentForm
        clients={clients ?? []}
        projects={projects ?? []}
        quotations={quotations ?? []}
        currency={selectedCurrency}
        defaultClientId={params.clientId}
        defaultProjectId={params.projectId}
        defaultQuotationId={params.quotationId}
        error={params.error}
      />
    </div>
  )
}
