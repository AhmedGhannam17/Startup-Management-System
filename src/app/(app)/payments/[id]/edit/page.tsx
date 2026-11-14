import { notFound, redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { PaymentForm, type PaymentFormValue } from '@/components/financial/payment-form'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function EditPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  if (!context.isManager)
    redirect('/payments?error=Only Owners and Project Managers can manage payments.')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createServerClient()
  const [{ data: payment }, { data: clients }, { data: projects }, { data: quotations }] =
    await Promise.all([
      supabase
        .from('payments')
        .select('*')
        .eq('organization_id', context.organization.id)
        .eq('id', id)
        .maybeSingle(),
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
  if (!payment) notFound()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle
        title="Edit payment"
        description="Changes are recorded in the payment audit history."
      />
      <PaymentForm
        clients={clients ?? []}
        projects={projects ?? []}
        quotations={quotations ?? []}
        currency={payment.currency}
        payment={payment as PaymentFormValue}
        error={query.error}
      />
    </div>
  )
}
