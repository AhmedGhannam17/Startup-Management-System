import { redirect } from 'next/navigation'
import { RecordForm, SectionTitle } from '@/components/clients-projects/record-form'
import { saveProject } from '@/app/actions/clients-projects'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context?.isManager) redirect('/projects')
  const supabase = await createServerClient()
  const [{ data: clients }, { error }] = await Promise.all([
    supabase
      .from('clients')
      .select('id,name')
      .eq('organization_id', context.organization.id)
      .is('archived_at', null)
      .order('name'),
    searchParams,
  ])
  return (
    <div className="max-w-5xl space-y-6">
      <SectionTitle
        title="Create project"
        description="Choose organization-wide access or restrict the project to assigned members. Configure detailed permissions after creation."
      />
      <RecordForm
        action={saveProject}
        error={error}
        fields={[
          { name: 'name', label: 'Project name', required: true },
          {
            name: 'clientId',
            label: 'Client',
            options: [
              ['', 'No client'],
              ...(clients ?? []).map((c) => [c.id, c.name] as [string, string]),
            ],
          },
          { name: 'projectType', label: 'Project type' },
          {
            name: 'status',
            label: 'Status',
            options: [
              ['planning', 'Planning'],
              ['in_progress', 'In progress'],
              ['on_hold', 'On hold'],
              ['completed', 'Completed'],
              ['cancelled', 'Cancelled'],
            ],
          },
          {
            name: 'priority',
            label: 'Priority',
            options: [
              ['medium', 'Medium'],
              ['low', 'Low'],
              ['high', 'High'],
              ['urgent', 'Urgent'],
            ],
          },
          {
            name: 'visibility',
            label: 'Visibility',
            options: [
              ['organization', 'Organization wide'],
              ['restricted', 'Restricted to assigned members'],
            ],
          },
          { name: 'startDate', label: 'Start date', type: 'date' },
          { name: 'deadline', label: 'Deadline', type: 'date' },
          { name: 'description', label: 'Description', multiline: true },
          {
            name: 'projectValue',
            label: `Project value (${context.organization.currency})`,
            type: 'number',
          },
          { name: 'technologyStack', label: 'Technology stack' },
          { name: 'repositoryUrl', label: 'Repository URL', type: 'url' },
          { name: 'liveUrl', label: 'Live URL', type: 'url' },
          { name: 'hostingProvider', label: 'Hosting provider' },
          { name: 'deploymentInformation', label: 'Deployment information', multiline: true },
          { name: 'technicalNotes', label: 'Technical notes', multiline: true },
          { name: 'internalNotes', label: 'Internal notes', multiline: true },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Technical and internal project information is protected by a separate database policy.
      </p>
    </div>
  )
}
