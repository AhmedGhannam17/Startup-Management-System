import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { createServerClient } from '@/lib/supabase/server'
import { TeamMemberList, type MemberItem } from '@/components/team/team-member-list'
import { InviteMemberDialog } from '@/components/team/invite-member-dialog'
import { InvitationList, type InvitationItem } from '@/components/team/invitation-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Database } from '@/types/supabase'

export const metadata: Metadata = {
  title: 'Team Management',
}

type OrgMemberRow = Database['public']['Tables']['organization_members']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type InvitationRow = Database['public']['Tables']['organization_invitations']['Row']

export default async function TeamPage() {
  const context = await getActiveOrganizationContext()

  if (!context) {
    redirect('/onboarding')
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch team members
  const { data: membersRaw } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', context.organization.id)
    .order('joined_at', { ascending: true })

  const membersList = (membersRaw || []) as OrgMemberRow[]
  const memberUserIds = membersList.map((m) => m.user_id)

  // Fetch profiles for these users
  const { data: profilesRaw } = memberUserIds.length > 0
    ? await supabase
        .from('profiles')
        .select('*')
        .in('id', memberUserIds)
    : { data: [] }

  const profilesList = (profilesRaw || []) as ProfileRow[]
  const profileMap = new Map<string, ProfileRow>()
  for (const p of profilesList) {
    profileMap.set(p.id, p)
  }

  const members: MemberItem[] = membersList.map((m) => {
    const prof = profileMap.get(m.user_id)
    return {
      id: m.id,
      userId: m.user_id,
      fullName: prof?.full_name || (m.user_id === user.id ? user.user_metadata?.full_name || 'Owner' : 'Team Member'),
      email: m.user_id === user.id ? user.email || '' : `user-${m.user_id.slice(0, 6)}@workspace`,
      avatarUrl: prof?.avatar_url,
      role: m.role,
      joinedAt: m.joined_at,
    }
  })

  // Fetch organization invitations
  const { data: invitationsRaw } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('organization_id', context.organization.id)
    .order('created_at', { ascending: false })

  const invitationsList = (invitationsRaw || []) as InvitationRow[]
  const invitations: InvitationItem[] = invitationsList.map((i) => ({
    id: i.id,
    email: i.email,
    recipientName: i.recipient_name,
    role: i.role,
    status: i.status,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
  }))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Team Members</h2>
          <p className="text-muted-foreground">
            Manage member access and roles for {context.organization.name}.
          </p>
        </div>
        <InviteMemberDialog isManager={context.isManager} />
      </div>

      {/* Active Members Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Active Members ({members.length})</CardTitle>
          <CardDescription>
            Members who currently have access to this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMemberList
            members={members}
            currentUserId={user.id}
            isOwner={context.isOwner}
          />
        </CardContent>
      </Card>

      {/* Pending & Past Invitations Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Invitations ({invitations.length})</CardTitle>
          <CardDescription>
            Outstanding and past member invitations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationList
            invitations={invitations}
            isManager={context.isManager}
          />
        </CardContent>
      </Card>
    </div>
  )
}
