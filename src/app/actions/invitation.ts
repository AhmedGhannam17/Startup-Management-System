'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { inviteMemberSchema } from '@/lib/validations/organization'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import type { Database, OrganizationRole } from '@/types/supabase'
import type { ActionResult } from './organization'

const ACTIVE_ORG_COOKIE = 'startuphub_active_org_id'

/**
 * Computes SHA-256 hash of a plaintext token using standard Web Crypto API.
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate secure random token string.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Invite a new member to the organization (Owner & Project Manager only).
 */
export async function inviteMember(formData: FormData): Promise<ActionResult<{ inviteUrl: string }>> {
  const context = await getActiveOrganizationContext()
  if (!context || !context.isManager) {
    return { success: false, error: 'Only Owners and Project Managers can invite new members' }
  }

  const rawData = {
    recipientName: (formData.get('recipientName') as string) || undefined,
    email: formData.get('email') as string,
    role: formData.get('role') as string,
  }

  const parsed = inviteMemberSchema.safeParse(rawData)
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

  // Prevent project managers from inviting owners
  if (!context.isOwner && parsed.data.role === 'owner') {
    return { success: false, error: 'Only Owners can invite new Owners' }
  }

  // Generate invitation token
  const token = generateToken()
  const tokenHash = await hashToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  // Insert invitation record
  const inviteData: Database['public']['Tables']['organization_invitations']['Insert'] = {
    organization_id: context.organization.id,
    email: parsed.data.email.toLowerCase(),
    recipient_name: parsed.data.recipientName || null,
    role: parsed.data.role as OrganizationRole,
    token_hash: tokenHash,
    invited_by: user.id,
    status: 'pending',
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  }

  const { error: inviteError } = await supabase
    .from('organization_invitations')
    .insert(inviteData as unknown as never)

  if (inviteError) {
    return { success: false, error: inviteError.message || 'Failed to create invitation' }
  }

  const reqHeaders = await headers()
  const origin = reqHeaders.get('origin') || 'http://localhost:3000'
  const inviteUrl = `${origin}/invite/${token}`

  revalidatePath('/team')
  return {
    success: true,
    message: `Invitation generated for ${parsed.data.email}`,
    data: { inviteUrl },
  }
}

/**
 * Revoke a pending invitation (Owner & Manager only).
 */
export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const context = await getActiveOrganizationContext()
  if (!context || !context.isManager) {
    return { success: false, error: 'Unauthorized to revoke invitations' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('organization_invitations')
    .update({ status: 'revoked' } as unknown as never)
    .eq('id', invitationId)
    .eq('organization_id', context.organization.id)

  if (error) {
    return { success: false, error: 'Failed to revoke invitation' }
  }

  revalidatePath('/team')
  return { success: true, message: 'Invitation revoked' }
}

/**
 * Accept an organization invitation using the plaintext token.
 */
export async function acceptInvitation(token: string): Promise<ActionResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in to accept an invitation.' }
  }

  const tokenHash = await hashToken(token)

  // Call the secure RPC
  const { data: orgId, error: rpcError } = await supabase.rpc('accept_invitation', {
    p_token_hash: tokenHash,
  } as unknown as never)

  if (rpcError) {
    return { success: false, error: rpcError.message }
  }

  // Set active org cookie
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, { path: '/' })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
