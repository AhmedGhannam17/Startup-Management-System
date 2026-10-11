import { redirect } from 'next/navigation'
import { saveClient } from '@/app/actions/clients-projects'
import { RecordForm, SectionTitle } from '@/components/clients-projects/record-form'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context?.isManager) redirect('/clients')
  const { error } = await searchParams
  return (
    <div className="max-w-4xl space-y-6">
      <SectionTitle
        title="Add client"
        description="Client contact details are visible to organization members. Tax and internal notes are limited to Owners and Project Managers."
      />
      <RecordForm
        action={saveClient}
        error={error}
        fields={[
          { name: 'name', label: 'Business / client name', required: true },
          { name: 'contactName', label: 'Primary contact' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'businessCategory', label: 'Business category' },
          { name: 'website', label: 'Website', type: 'url' },
          { name: 'address', label: 'Address', multiline: true },
          { name: 'taxId', label: 'Tax / business ID' },
          { name: 'internalNotes', label: 'Internal notes', multiline: true },
        ]}
      />
    </div>
  )
}
