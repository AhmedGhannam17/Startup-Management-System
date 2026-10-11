import { notFound, redirect } from 'next/navigation'
import { saveClient } from '@/app/actions/clients-projects'
import { RecordForm, SectionTitle } from '@/components/clients-projects/record-form'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import type { Database } from '@/types/supabase'

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context?.isManager) redirect('/clients')
  const { id } = await params
  const supabase = await createServerClient()
  const [{ data: cData }, { data: detailsData }, { error }] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .maybeSingle(),
    supabase.from('client_private_details').select('*').eq('client_id', id).maybeSingle(),
    searchParams,
  ])
  const c = cData as unknown as Database['public']['Tables']['clients']['Row'] | null
  const details = detailsData as unknown as
    Database['public']['Tables']['client_private_details']['Row'] | null
  if (!c) notFound()
  return (
    <div className="max-w-4xl space-y-6">
      <SectionTitle title="Edit client" />
      <RecordForm
        action={saveClient}
        id={id}
        error={error}
        fields={[
          { name: 'name', label: 'Business / client name', required: true, value: c.name },
          { name: 'contactName', label: 'Primary contact', value: c.contact_name },
          { name: 'email', label: 'Email', type: 'email', value: c.email },
          { name: 'phone', label: 'Phone', type: 'tel', value: c.phone },
          { name: 'businessCategory', label: 'Business category', value: c.business_category },
          { name: 'website', label: 'Website', type: 'url', value: c.website },
          { name: 'address', label: 'Address', multiline: true, value: c.address },
          { name: 'taxId', label: 'Tax / business ID', value: details?.tax_id },
          {
            name: 'internalNotes',
            label: 'Internal notes',
            multiline: true,
            value: details?.internal_notes,
          },
        ]}
      />
    </div>
  )
}
