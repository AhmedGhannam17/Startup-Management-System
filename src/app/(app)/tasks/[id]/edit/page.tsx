import { notFound, redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { TaskForm, type TaskFormValue } from '@/components/work-management/task-form'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createServerClient()
  const [{ data: taskData }, { data: members }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('organization_members')
      .select('user_id,role')
      .eq('organization_id', context.organization.id),
  ])
  if (!taskData) notFound()
  const [{ data: project }, { data: permission }] = await Promise.all([
    supabase
      .from('projects')
      .select('id,name,created_by')
      .eq('organization_id', context.organization.id)
      .eq('id', taskData.project_id)
      .maybeSingle(),
    supabase
      .from('project_members')
      .select('is_project_manager,can_manage_tasks')
      .eq('organization_id', context.organization.id)
      .eq('project_id', taskData.project_id)
      .eq('user_id', context.membership.user_id)
      .maybeSingle(),
  ])
  const canManage = Boolean(
    context.isOwner ||
    (context.role === 'project_manager' && project?.created_by === context.membership.user_id) ||
    permission?.is_project_manager ||
    permission?.can_manage_tasks
  )
  if (!canManage || !project) notFound()
  const [{ data: milestones }, { data: profiles }] = await Promise.all([
    supabase
      .from('milestones')
      .select('id,project_id,name')
      .eq('organization_id', context.organization.id)
      .eq('project_id', project.id)
      .order('name'),
    members?.length
      ? supabase
          .from('profiles')
          .select('id,full_name')
          .in(
            'id',
            members.map((member) => member.user_id)
          )
      : Promise.resolve({ data: [] }),
  ])
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const task = taskData as TaskFormValue
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle title="Edit task" description="Update the task details and assignment." />
      <TaskForm
        projects={[{ id: project.id, name: project.name }]}
        milestones={milestones ?? []}
        members={(members ?? []).map((member) => ({
          id: member.user_id,
          name: profileNames.get(member.user_id) || 'Team member',
          role: member.role.replace('_', ' '),
        }))}
        task={task}
        error={query.error}
      />
    </div>
  )
}
