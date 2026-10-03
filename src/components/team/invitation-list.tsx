'use client'

import { useState, useTransition } from 'react'
import { Mail, Trash2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { revokeInvitation } from '@/app/actions/invitation'
import type { OrganizationRole, InvitationStatus } from '@/types/supabase'

export interface InvitationItem {
  id: string
  email: string
  recipientName?: string | null
  role: OrganizationRole
  status: InvitationStatus
  createdAt: string
  expiresAt: string
}

interface InvitationListProps {
  invitations: InvitationItem[]
  isManager: boolean
}

export function InvitationList({ invitations, isManager }: InvitationListProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleRevoke = (invitationId: string, email: string) => {
    if (!isManager) return
    if (!confirm(`Revoke invitation for ${email}?`)) return

    setError(null)
    startTransition(async () => {
      const result = await revokeInvitation(invitationId)
      if (!result.success) {
        setError(result.error)
      }
    })
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
        No active invitations. Click &quot;Invite Team Member&quot; to invite a colleague.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Assigned Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              {isManager && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((inv) => {
              const isExpired = new Date(inv.expiresAt) < new Date()
              const effectiveStatus = isExpired && inv.status === 'pending' ? 'expired' : inv.status

              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {inv.recipientName || inv.email}
                      </div>
                      {inv.recipientName && (
                        <div className="text-xs text-muted-foreground">{inv.email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-xs font-medium">
                    {inv.role.replace('_', ' ')}
                  </TableCell>
                  <TableCell>
                    {effectiveStatus === 'pending' && <Badge variant="warning">Pending</Badge>}
                    {effectiveStatus === 'accepted' && <Badge variant="success">Accepted</Badge>}
                    {effectiveStatus === 'expired' && <Badge variant="outline">Expired</Badge>}
                    {effectiveStatus === 'revoked' && <Badge variant="destructive">Revoked</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(inv.expiresAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      {effectiveStatus === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRevoke(inv.id, inv.email)}
                          disabled={isPending}
                          title="Revoke invitation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
