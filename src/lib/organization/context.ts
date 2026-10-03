import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
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

const ACTIVE_ORG_COOKIE = 'startuphub_active_org_id'

/**
 * Gets all organizations that the current authenticated user belongs to.
 */
export async function getUserOrganizations() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      role,
      organization:organizations(*)
    `)
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
export async function getActiveOrganizationContext(): Promise<OrganizationContext | null> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const userOrgs = await getUserOrganizations()
  if (userOrgs.length === 0) return null

  const cookieStore = await cookies()
  const activeOrgIdCookie = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  let activeItem = userOrgs.find((item) => item.organization.id === activeOrgIdCookie)
  if (!activeItem) {
    activeItem = userOrgs[0]
  }

  const { data: membershipRaw } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', activeItem.organization.id)
    .eq('user_id', user.id)
    .single()

  const membership = membershipRaw as OrganizationMember | null

  if (!membership) return null

  return {
    organization: activeItem.organization,
    membership,
    role: membership.role,
    isOwner: membership.role === 'owner',
    isManager: membership.role === 'owner' || membership.role === 'project_manager',
    userOrganizations: userOrgs,
  }
}
