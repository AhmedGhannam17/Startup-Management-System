import { redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { TaskForm } from '@/components/work-management/task-form'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const params = await searchParams
  const supabase = await createServerClient()
  const [{ data: projects }, { data: memberships }] = await Promise.all([
    supabase
      .from('projects')
      .select('id,name,created_by')
      .eq('organization_id', context.organization.id)
      .order('name'),
    supabase
      .from('project_members')
      .select('project_id,is_project_manager,can_manage_tasks')
      .eq('organization_id', context.organization.id)
      .eq('user_id', context.membership.user_id),
  ])
  const manageable = (projects ?? []).filter((project) => {
    const permission = (memberships ?? []).find((item) => item.project_id === project.id)
    return (
      context.isOwner ||
      (context.role === 'project_manager' && project.created_by === context.membership.user_id) ||
      permission?.is_project_manager ||
      permission?.can_manage_tasks
    )
  })
  if (!manageable.length)
    redirect('/tasks?error=You do not have permission to create tasks in a project yet.')
  const projectIds = manageable.map((project) => project.id)
  const [{ data: milestones }, { data: members }] = await Promise.all([
    supabase
      .from('milestones')
      .select('id,project_id,name')
      .eq('organization_id', context.organization.id)
      .in('project_id', projectIds)
      .order('name'),
    supabase
      .from('organization_members')
      .select('user_id,role')
      .eq('organization_id', context.organization.id),
  ])
  const ids = (members ?? []).map((member) => member.user_id)
  const { data: profiles } = ids.length
    ? await supabase.from('profiles').select('id,full_name').in('id', ids)
    : { data: [] }
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const memberOptions = (members ?? []).map((member) => ({
    id: member.user_id,
    name: profileNames.get(member.user_id) || 'Team member',
    role: member.role.replace('_', ' '),
  }))
  const projectOptions = manageable.map(({ id, name }) => ({ id, name }))
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle
        title="Create task"
        description="Add work to a project and assign a clear owner."
      />
      <TaskForm
        projects={projectOptions}
        milestones={milestones ?? []}
        members={memberOptions}
        defaultProjectId={
          projectOptions.some((project) => project.id === params.projectId)
            ? params.projectId
            : undefined
        }
        error={params.error}
      />
    </div>
  )
}
