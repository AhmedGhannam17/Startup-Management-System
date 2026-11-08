import { cookies } from 'next/headers'
import { cache } from 'react'
import { createServerClient, getCurrentUser } from '@/lib/supabase/server'
import type { Database, OrganizationRole } from '@/types/supabase'

export type Organization = Database['public']['Tables']['organizations']['Row']
export type OrganizationMember = Database['public']['Tables']['organization_members']['Row']

export interface OrganizationContext {
  organization: Organization
  membership: OrganizationMember
  role: OrganizationRole
  isOwner: boolean
  isManager: boolean
  userOrganizations: Array<{
    organization: Organization
    role: OrganizationRole
  }>
}

const ACTIVE_ORG_COOKIE = 'upwego_active_org_id'
const LEGACY_ACTIVE_ORG_COOKIE = 'startuphub_active_org_id'

/**
 * Gets all organizations that the current authenticated user belongs to.
 */
export async function getUserOrganizations() {
  const user = await getCurrentUser()
  if (!user) return []
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('organization_members')
    .select(
      `
      role,
      organization_id,
      organization:organizations(*)
    `
    )
    .eq('user_id', user.id)

  if (error || !data) {
    return []
  }

  const typedData = data as unknown as { role: OrganizationRole; organization: Organization }[]

  return typedData
    .filter((item) => item.organization !== null)
    .map((item) => ({
      organization: item.organization as Organization,
      role: item.role,
    }))
}

/**
 * Resolves the active organization context for the current request.
 * Returns null if the user has no organizations or is not authenticated.
 */
export const getActiveOrganizationContext = cache(async (): Promise<OrganizationContext | null> => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createServerClient()

  // Fetch each membership and its organization together. The previous flow did
  // separate Auth and membership requests, then fetched the active membership
  // a second time.
  const { data: membershipsRaw, error } = await supabase
    .from('organization_members')
    .select('*, organization:organizations(*)')
    .eq('user_id', user.id)

  if (error || !membershipsRaw?.length) return null

  const memberships = membershipsRaw as unknown as Array<
    OrganizationMember & { organization: Organization | null }
  >
  const userOrgs = memberships
    .filter((membership) => membership.organization !== null)
    .map((membership) => ({
      organization: membership.organization as Organization,
      role: membership.role as OrganizationRole,
    }))
  if (userOrgs.length === 0) return null

  const cookieStore = await cookies()
  const activeOrgIdCookie =
    cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? cookieStore.get(LEGACY_ACTIVE_ORG_COOKIE)?.value

  const availableMemberships = memberships.filter(
    (item): item is OrganizationMember & { organization: Organization } =>
      item.organization !== null
  )
  const activeMembership =
    availableMemberships.find((item) => item.organization.id === activeOrgIdCookie) ??
    availableMemberships[0]
  const { organization, ...membership } = activeMembership

  return {
    organization,
    membership,
    role: membership.role as OrganizationRole,
    isOwner: membership.role === 'owner',
    isManager: membership.role === 'owner' || membership.role === 'project_manager',
    userOrganizations: userOrgs,
  }
})
