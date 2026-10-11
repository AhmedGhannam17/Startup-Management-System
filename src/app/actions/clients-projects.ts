'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { clientSchema } from '@/lib/validations/client'
import { projectSchema } from '@/lib/validations/project'

function value(form: FormData, key: string) {
  const item = form.get(key)
  return typeof item === 'string' ? item.trim() : ''
}

function clientInput(form: FormData) {
  return clientSchema.safeParse({
    name: value(form, 'name'),
    contactName: value(form, 'contactName'),
    email: value(form, 'email'),
    phone: value(form, 'phone'),
    address: value(form, 'address'),
    website: value(form, 'website'),
    businessCategory: value(form, 'businessCategory'),
    taxId: value(form, 'taxId'),
    internalNotes: value(form, 'internalNotes'),
  })
}

export async function saveClient(form: FormData) {
  const context = await getActiveOrganizationContext()
  if (!context?.isManager) redirect('/clients?error=forbidden')
  const parsed = clientInput(form)
  if (!parsed.success)
    redirect(
      `/clients/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid client')}`
    )
  const supabase = await createServerClient()
  const id = value(form, 'id')
  const payload = {
    name: parsed.data.name,
    contact_name: parsed.data.contactName || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    website: parsed.data.website || null,
    business_category: parsed.data.businessCategory || null,
  }
  let clientId = id
  if (id) {
    const { error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', id)
      .eq('organization_id', context.organization.id)
    if (error) redirect(`/clients/${id}/edit?error=${encodeURIComponent(error.message)}`)
  } else {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...payload, organization_id: context.organization.id })
      .select('id')
      .single()
    if (error || !data)
      redirect(
        `/clients/new?error=${encodeURIComponent(error?.message ?? 'Unable to create client')}`
      )
    clientId = data.id
  }
  const { error: privateError } = await supabase.from('client_private_details').upsert({
    organization_id: context.organization.id,
    client_id: clientId!,
    tax_id: parsed.data.taxId || null,
    internal_notes: parsed.data.internalNotes || null,
  })
  if (privateError)
    redirect(
      `/clients/${clientId}/edit?error=${encodeURIComponent('Client saved, but private details could not be saved: ' + privateError.message)}`
    )
  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  redirect(`/clients/${clientId}`)
}

export async function archiveClient(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = value(form, 'id')
  if (!context?.isManager) redirect('/clients?error=forbidden')
  const supabase = await createServerClient()
  const archived = value(form, 'archived') === 'true'
  const { error } = await supabase
    .from('clients')
    .update({ archived_at: archived ? null : new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', context.organization.id)
  if (error) redirect(`/clients/${id}?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  redirect(`/clients/${id}`)
}

function projectInput(form: FormData) {
  return projectSchema.safeParse({
    name: value(form, 'name'),
    description: value(form, 'description'),
    projectType: value(form, 'projectType'),
    clientId: value(form, 'clientId'),
    status: value(form, 'status'),
    priority: value(form, 'priority'),
    startDate: value(form, 'startDate'),
    deadline: value(form, 'deadline'),
    visibility: value(form, 'visibility'),
    projectValue: value(form, 'projectValue'),
    technologyStack: value(form, 'technologyStack'),
    repositoryUrl: value(form, 'repositoryUrl'),
    liveUrl: value(form, 'liveUrl'),
    hostingProvider: value(form, 'hostingProvider'),
    deploymentInformation: value(form, 'deploymentInformation'),
    technicalNotes: value(form, 'technicalNotes'),
    internalNotes: value(form, 'internalNotes'),
  })
}

export async function saveProject(form: FormData) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/projects?error=forbidden')
  const id = value(form, 'id')
  const parsed = projectInput(form)
  if (!parsed.success)
    redirect(
      `${id ? `/projects/${id}/edit` : '/projects/new'}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid project')}`
    )
  const supabase = await createServerClient()
  const project = parsed.data
  const payload = {
    name: project.name,
    description: project.description || null,
    project_type: project.projectType || null,
    client_id: project.clientId || null,
    status: project.status,
    priority: project.priority,
    start_date: project.startDate || null,
    deadline: project.deadline || null,
    visibility: project.visibility,
  }
  let projectId = id
  if (!id) {
    if (!context.isManager) redirect('/projects?error=forbidden')
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...payload, organization_id: context.organization.id })
      .select('id')
      .single()
    if (error || !data)
      redirect(
        `/projects/new?error=${encodeURIComponent(error?.message ?? 'Unable to create project')}`
      )
    projectId = data.id
  } else {
    const { data: existing } = await supabase
      .from('projects')
      .select('visibility')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .maybeSingle()
    if (!existing) redirect('/projects?error=not-found')
    const { data: access } = await supabase
      .from('project_members')
      .select('can_edit,is_project_manager')
      .eq('project_id', id)
      .eq('user_id', context.membership.user_id)
      .maybeSingle()
    if (!context.isOwner && !access?.is_project_manager && !access?.can_edit)
      redirect(`/projects/${id}?error=You do not have permission to edit this project`)
    if (existing.visibility !== project.visibility && !context.isManager)
      redirect(
        `/projects/${id}/edit?error=Only an organization Owner or Project Manager can change project visibility`
      )
    const { error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', id)
      .eq('organization_id', context.organization.id)
    if (error) redirect(`/projects/${id}/edit?error=${encodeURIComponent(error.message)}`)
  }
  const { data: access } = await supabase
    .from('project_members')
    .select('is_project_manager,can_edit_info,can_access_sensitive')
    .eq('project_id', projectId!)
    .eq('user_id', context.membership.user_id)
    .maybeSingle()
  const canEditSensitive = context.isOwner || access?.is_project_manager || access?.can_edit_info
  const creating = !id && context.isManager
  if (canEditSensitive || creating) {
    const amount = project.projectValue ? Number(project.projectValue) : null
    const { error } = await supabase.from('project_private_details').upsert({
      organization_id: context.organization.id,
      project_id: projectId!,
      project_value: amount,
      technology_stack: project.technologyStack || null,
      repository_url: project.repositoryUrl || null,
      live_url: project.liveUrl || null,
      hosting_provider: project.hostingProvider || null,
      deployment_information: project.deploymentInformation || null,
      technical_notes: project.technicalNotes || null,
      internal_notes: project.internalNotes || null,
    })
    if (error) redirect(`/projects/${projectId}/edit?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  redirect(`/projects/${projectId}`)
}

export async function saveProjectMembers(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = value(form, 'projectId')
  if (!context) redirect('/projects')
  const supabase = await createServerClient()
  const { data: project } = await supabase
    .from('projects')
    .select('created_by')
    .eq('id', id)
    .eq('organization_id', context.organization.id)
    .maybeSingle()
  if (!project) redirect('/projects')
  const { data: myAccess } = await supabase
    .from('project_members')
    .select('is_project_manager,can_manage_members')
    .eq('project_id', id)
    .eq('user_id', context.membership.user_id)
    .maybeSingle()
  if (
    !context.isOwner &&
    !(context.role === 'project_manager' && project.created_by === context.membership.user_id) &&
    !myAccess?.is_project_manager &&
    !myAccess?.can_manage_members
  )
    redirect(`/projects/${id}?error=forbidden`)
  const { data: people } = await supabase
    .from('organization_members')
    .select('user_id,role')
    .eq('organization_id', context.organization.id)
  const { data: existing } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', id)
    .eq('organization_id', context.organization.id)
  const existingIds = new Set((existing ?? []).map((m) => m.user_id))
  const selectedIds = new Set(
    form.getAll('userId').filter((v): v is string => typeof v === 'string')
  )
  selectedIds.add(project.created_by)
  const chosenManager = value(form, 'managerId')
  if (chosenManager) selectedIds.add(chosenManager)
  const validPeople = (people ?? []).filter((p) => selectedIds.has(p.user_id))
  if (
    chosenManager &&
    !validPeople.some((p) => p.user_id === chosenManager && p.role === 'project_manager')
  )
    redirect(`/projects/${id}?error=Only a Project Manager can be assigned as the project manager`)
  const rows = validPeople.map((person) => ({
    organization_id: context.organization.id,
    project_id: id,
    user_id: person.user_id,
    is_project_manager: person.user_id === chosenManager,
    can_view:
      person.user_id === project.created_by ||
      form.get(`view:${person.user_id}`) === 'on' ||
      person.user_id === chosenManager,
    can_edit:
      person.user_id === project.created_by ||
      form.get(`edit:${person.user_id}`) === 'on' ||
      person.user_id === chosenManager,
    can_manage_members:
      person.user_id === project.created_by ||
      form.get(`members:${person.user_id}`) === 'on' ||
      person.user_id === chosenManager,
    can_manage_tasks: form.get(`tasks:${person.user_id}`) === 'on',
    can_manage_milestones: form.get(`milestones:${person.user_id}`) === 'on',
    can_edit_info: form.get(`info:${person.user_id}`) === 'on' || person.user_id === chosenManager,
    can_access_sensitive:
      form.get(`sensitive:${person.user_id}`) === 'on' || person.user_id === chosenManager,
  }))
  const toRemove = [...existingIds].filter((userId) => !selectedIds.has(userId))
  if (toRemove.length)
    await supabase.from('project_members').delete().eq('project_id', id).in('user_id', toRemove)
  if (rows.length) {
    const { error } = await supabase
      .from('project_members')
      .upsert(rows, { onConflict: 'organization_id,project_id,user_id' })
    if (error) redirect(`/projects/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath(`/projects/${id}`)
  redirect(`/projects/${id}`)
}
