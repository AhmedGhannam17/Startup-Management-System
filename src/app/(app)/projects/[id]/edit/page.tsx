import { notFound, redirect } from 'next/navigation'
import { RecordForm, SectionTitle } from '@/components/clients-projects/record-form'
import { saveProject } from '@/app/actions/clients-projects'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/projects')
  const { id } = await params
  const supabase = await createServerClient()
  const [{ data: p }, { data: d }, { data: clients }, { error }] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .maybeSingle(),
    supabase.from('project_private_details').select('*').eq('project_id', id).maybeSingle(),
    supabase
      .from('clients')
      .select('id,name')
      .eq('organization_id', context.organization.id)
      .is('archived_at', null)
      .order('name'),
    searchParams,
  ])
  if (!p) notFound()
  return (
    <div className="max-w-5xl space-y-6">
      <SectionTitle title="Edit project" />
      <RecordForm
        action={saveProject}
        id={id}
        error={error}
        fields={[
          { name: 'name', label: 'Project name', required: true, value: p.name },
          {
            name: 'clientId',
            label: 'Client',
            value: p.client_id,
            options: [
              ['', 'No client'],
              ...(clients ?? []).map((c) => [c.id, c.name] as [string, string]),
            ],
          },
          { name: 'projectType', label: 'Project type', value: p.project_type },
          {
            name: 'status',
            label: 'Status',
            value: p.status,
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
            value: p.priority,
            options: [
              ['low', 'Low'],
              ['medium', 'Medium'],
              ['high', 'High'],
              ['urgent', 'Urgent'],
            ],
          },
          {
            name: 'visibility',
            label: 'Visibility',
            value: p.visibility,
            options: [
              ['organization', 'Organization wide'],
              ['restricted', 'Restricted'],
            ],
          },
          { name: 'startDate', label: 'Start date', type: 'date', value: p.start_date },
          { name: 'deadline', label: 'Deadline', type: 'date', value: p.deadline },
          { name: 'description', label: 'Description', multiline: true, value: p.description },
          {
            name: 'projectValue',
            label: `Project value (${context.organization.currency})`,
            type: 'number',
            value: d?.project_value?.toString(),
          },
          { name: 'technologyStack', label: 'Technology stack', value: d?.technology_stack },
          { name: 'repositoryUrl', label: 'Repository URL', type: 'url', value: d?.repository_url },
          { name: 'liveUrl', label: 'Live URL', type: 'url', value: d?.live_url },
          { name: 'hostingProvider', label: 'Hosting provider', value: d?.hosting_provider },
          {
            name: 'deploymentInformation',
            label: 'Deployment information',
            multiline: true,
            value: d?.deployment_information,
          },
          {
            name: 'technicalNotes',
            label: 'Technical notes',
            multiline: true,
            value: d?.technical_notes,
          },
          {
            name: 'internalNotes',
            label: 'Internal notes',
            multiline: true,
            value: d?.internal_notes,
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Sensitive fields appear only when your project permissions allow access.
      </p>
    </div>
  )
}
