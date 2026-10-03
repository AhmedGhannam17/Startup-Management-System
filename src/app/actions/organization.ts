'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  updateMemberRoleSchema,
} from '@/lib/validations/organization'
import { getActiveOrganizationContext } from '@/lib/organization/context'

const ACTIVE_ORG_COOKIE = 'startuphub_active_org_id'

export type ActionResult<T = unknown> =
  | { success: true; message?: string; data?: T }
  | { success: false; error: string }

/**
 * Creates a slug from organization name.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Create a new organization and assign current user as Owner.
 */
export async function createOrganization(formData: FormData): Promise<ActionResult<{ orgId: string }>> {
  const rawData = {
    name: formData.get('name') as string,
    email: (formData.get('email') as string) || undefined,
    phone: (formData.get('phone') as string) || undefined,
    address: (formData.get('address') as string) || undefined,
    website: (formData.get('website') as string) || undefined,
    businessDescription: (formData.get('businessDescription') as string) || undefined,
    taxId: (formData.get('taxId') as string) || undefined,
    currency: (formData.get('currency') as string) || 'USD',
  }

  const parsed = createOrganizationSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  // Generate unique slug
  const baseSlug = slugify(parsed.data.name) || 'org'
  let slug = baseSlug
  let counter = 1

  while (true) {
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    slug = `${baseSlug}-${counter}`
    counter++
  }

  // 1. Insert organization
  const { data: orgRaw, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: parsed.data.name,
      slug,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      website: parsed.data.website || null,
      business_description: parsed.data.businessDescription || null,
      tax_id: parsed.data.taxId || null,
      currency: parsed.data.currency,
    } as unknown as never)
    .select('id')
    .single()

  const org = orgRaw as { id: string } | null

  if (orgError || !org) {
    return { success: false, error: orgError?.message || 'Failed to create organization' }
  }

  // 2. Insert creator as Owner
  const { error: memberError } = await supabase.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'owner',
  } as unknown as never)

  if (memberError) {
    // Cleanup inserted org if membership failed
    await supabase.from('organizations').delete().eq('id', org.id)
    return { success: false, error: 'Failed to assign organization ownership' }
  }

  // Set active org cookie
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, org.id, { path: '/' })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Update organization settings/profile (Owner only).
 */
export async function updateOrganization(formData: FormData): Promise<ActionResult> {
  const context = await getActiveOrganizationContext()
  if (!context || !context.isOwner) {
    return { success: false, error: 'Only the Organization Owner can modify settings' }
  }

  const rawData = {
    name: formData.get('name') as string,
    email: (formData.get('email') as string) || undefined,
    phone: (formData.get('phone') as string) || undefined,
    address: (formData.get('address') as string) || undefined,
    website: (formData.get('website') as string) || undefined,
    businessDescription: (formData.get('businessDescription') as string) || undefined,
    taxId: (formData.get('taxId') as string) || undefined,
    currency: (formData.get('currency') as string) || 'USD',
  }

  const parsed = updateOrganizationSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      website: parsed.data.website || null,
      business_description: parsed.data.businessDescription || null,
      tax_id: parsed.data.taxId || null,
      currency: parsed.data.currency,
      updated_at: new Date().toISOString(),
    } as unknown as never)
    .eq('id', context.organization.id)

  if (error) {
    return { success: false, error: 'Failed to update organization settings' }
  }

  revalidatePath('/', 'layout')
  return { success: true, message: 'Organization settings updated successfully' }
}

/**
 * Switch active organization context cookie.
 */
export async function switchActiveOrganization(orgId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, { path: '/' })
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Update member role (Owner only).
 */
export async function updateMemberRole(formData: FormData): Promise<ActionResult> {
  const context = await getActiveOrganizationContext()
  if (!context || !context.isOwner) {
    return { success: false, error: 'Only the Organization Owner can manage member roles' }
  }

  const rawData = {
    memberId: formData.get('memberId') as string,
    role: formData.get('role') as string,
  }

  const parsed = updateMemberRoleSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createServerClient()

  // Prevent demoting the last Owner
  if (parsed.data.role !== 'owner') {
    const { data: owners } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', context.organization.id)
      .eq('role', 'owner')

    if (owners && owners.length <= 1) {
      const { data: targetRaw } = await supabase
        .from('organization_members')
        .select('role')
        .eq('id', parsed.data.memberId)
        .single()

      const target = targetRaw as { role: string } | null

      if (target?.role === 'owner') {
        return {
          success: false,
          error: 'Cannot demote the only Owner of the organization. Promote another member to Owner first.',
        }
      }
    }
  }

  const { error } = await supabase
    .from('organization_members')
    .update({
      role: parsed.data.role,
      updated_at: new Date().toISOString(),
    } as unknown as never)
    .eq('id', parsed.data.memberId)
    .eq('organization_id', context.organization.id)

  if (error) {
    return { success: false, error: 'Failed to update member role' }
  }

  revalidatePath('/team')
  return { success: true, message: 'Member role updated' }
}

/**
 * Remove a member from the organization (Owner only).
 */
export async function removeMember(memberId: string): Promise<ActionResult> {
  const context = await getActiveOrganizationContext()
  if (!context || !context.isOwner) {
    return { success: false, error: 'Only the Organization Owner can remove members' }
  }

  const supabase = await createServerClient()

  // Check if member is an owner
  const { data: targetMemberRaw } = await supabase
    .from('organization_members')
    .select('role, user_id')
    .eq('id', memberId)
    .eq('organization_id', context.organization.id)
    .single()

  const targetMember = targetMemberRaw as { role: string; user_id: string } | null

  if (!targetMember) {
    return { success: false, error: 'Member not found' }
  }

  if (targetMember.role === 'owner') {
    const { data: owners } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', context.organization.id)
      .eq('role', 'owner')

    if (owners && owners.length <= 1) {
      return { success: false, error: 'Cannot remove the last Owner of the organization' }
    }
  }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', context.organization.id)

  if (error) {
    return { success: false, error: 'Failed to remove member' }
  }

  revalidatePath('/team')
  return { success: true, message: 'Member removed from organization' }
}
