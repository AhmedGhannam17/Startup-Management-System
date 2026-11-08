'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAccessTokenDataClient, createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { clientSchema } from '@/lib/validations/client'
import { projectSchema } from '@/lib/validations/project'
import { getUserFriendlyDatabaseError } from '@/lib/errors'

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
    if (error)
      redirect(
        `/clients/${id}/edit?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`
      )
  } else {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...payload, organization_id: context.organization.id })
      .select('id')
      .single()
    if (error || !data)
      redirect(`/clients/new?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
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
      `/clients/${clientId}/edit?error=${encodeURIComponent(getUserFriendlyDatabaseError(privateError, 'Client saved, but its private details could not be saved.'))}`
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
  if (error)
    redirect(`/clients/${id}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
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
  const authClient = await createServerClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) redirect('/login?error=session-expired')
  if (user.id !== context.membership.user_id)
    redirect(
      '/projects/new?error=Your sign-in session does not match your organization membership. Sign out, sign back in with the Owner account, and try again.'
    )
  const {
    data: { session },
  } = await authClient.auth.getSession()
  if (!session) redirect('/login?error=session-expired')
  if (session.user.id !== user.id)
    redirect(
      '/projects/new?error=Your database session belongs to a different account. Refresh the page and sign in again.'
    )
  // Verify the actual JWT used by PostgREST. session.user is cached session
  // metadata; RLS evaluates the token's `sub` claim through auth.uid().
  let tokenSubject: string | undefined
  try {
    const encodedPayload = session.access_token.split('.')[1]
    tokenSubject = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')).sub
  } catch {
    redirect(
      '/projects/new?error=Your database session is invalid. Refresh the page and try again.'
    )
  }
  if (!tokenSubject || tokenSubject !== user.id)
    redirect(
      '/projects/new?error=Your database session does not match your signed-in account. Refresh the page and sign in again.'
    )
  const supabase = createAccessTokenDataClient(session.access_token)
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
    // PostgREST's INSERT ... RETURNING also applies the projects SELECT policy.
    // That policy's visibility helper reads projects, so the row being inserted
    // is not visible to the helper inside the same statement. Generate the ID
    // on the server and insert without RETURNING to avoid that unrelated SELECT.
    const newProjectId = randomUUID()
    const { error } = await supabase.from('projects').insert({
      ...payload,
      id: newProjectId,
      organization_id: context.organization.id,
    })
    if (error?.code === '42501') {
      console.error('[projects.create] RLS denied project insert after server authorization', {
        organizationRole: context.role,
        activeOrganizationId: context.organization.id,
        sessionMatchesMembership: user.id === context.membership.user_id,
        tokenMatchesAuthenticatedUser: tokenSubject === user.id,
        databaseError: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      })
      redirect(
        '/projects/new?error=The database could not verify your Owner or Project Manager membership in the active organization. Confirm the correct workspace is selected, then sign out and back into the Owner account.'
      )
    }
    if (error)
      redirect(`/projects/new?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
    projectId = newProjectId
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
    if (error)
      redirect(
        `/projects/${id}/edit?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`
      )
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
    if (error)
      redirect(
        `/projects/${projectId}/edit?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`
      )
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
    if (error)
      redirect(`/projects/${id}?error=${encodeURIComponent(getUserFriendlyDatabaseError(error))}`)
  }
  revalidatePath(`/projects/${id}`)
  redirect(`/projects/${id}`)
}
