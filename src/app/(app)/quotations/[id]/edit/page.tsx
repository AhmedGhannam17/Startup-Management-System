import { notFound, redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { QuotationForm, type QuotationFormValue } from '@/components/financial/quotation-form'
import type { QuotationLineInput } from '@/components/financial/quotation-line-items'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function EditQuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  if (!context.isManager)
    redirect('/quotations?error=Only Owners and Project Managers can manage quotations.')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createServerClient()
  const [{ data: quote }, { data: lineItems }, { data: clients }, { data: projects }] =
    await Promise.all([
      supabase
        .from('quotations')
        .select('*')
        .eq('organization_id', context.organization.id)
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('quotation_line_items')
        .select('description,quantity,unit_price,discount_percent,tax_percent,sort_order')
        .eq('organization_id', context.organization.id)
        .eq('quotation_id', id)
        .order('sort_order'),
      supabase
        .from('clients')
        .select('id,name,archived_at')
        .eq('organization_id', context.organization.id)
        .order('name'),
      supabase
        .from('projects')
        .select('id,name,client_id')
        .eq('organization_id', context.organization.id)
        .order('name'),
    ])
  if (!quote) notFound()
  if (quote.status !== 'draft') notFound()
  const clientOptions = (clients ?? [])
    .filter((client) => !client.archived_at || client.id === quote.client_id)
    .map((client) => ({
      id: client.id,
      name: `${client.name}${client.archived_at ? ' · archived' : ''}`,
    }))
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionTitle
        title="Edit quotation draft"
        description={`${quote.quote_number} · Changes are available until the quotation is issued.`}
      />
      <QuotationForm
        clients={clientOptions}
        projects={projects ?? []}
        currency={quote.currency}
        quotation={quote as QuotationFormValue}
        lineItems={(lineItems ?? []) as QuotationLineInput[]}
        error={query.error}
      />
    </div>
  )
}
