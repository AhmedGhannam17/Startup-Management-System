'use client'

import { useState, useTransition } from 'react'
import { Shield, ShieldAlert, User, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateMemberRole, removeMember } from '@/app/actions/organization'
import type { OrganizationRole } from '@/types/supabase'

export interface MemberItem {
  id: string
  userId: string
  fullName: string
  email: string
  avatarUrl?: string | null
  role: OrganizationRole
  joinedAt: string
}

interface TeamMemberListProps {
  members: MemberItem[]
  currentUserId: string
  isOwner: boolean
}

export function TeamMemberList({ members, currentUserId, isOwner }: TeamMemberListProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleRoleChange = (memberId: string, newRole: OrganizationRole) => {
    if (!isOwner) return
    setError(null)
    const formData = new FormData()
    formData.set('memberId', memberId)
    formData.set('role', newRole)

    startTransition(async () => {
      const result = await updateMemberRole(formData)
      if (!result.success) {
        setError(result.error)
      }
    })
  }

  const handleRemove = (memberId: string, memberName: string) => {
    if (!isOwner) return
    if (!confirm(`Are you sure you want to remove ${memberName} from the organization?`)) return

    setError(null)
    startTransition(async () => {
      const result = await removeMember(memberId)
      if (!result.success) {
        setError(result.error)
      }
    })
  }

  function getRoleBadge(role: OrganizationRole) {
    switch (role) {
      case 'owner':
        return (
          <Badge variant="default" className="gap-1">
            <ShieldAlert className="h-3 w-3" /> Owner
          </Badge>
        )
      case 'project_manager':
        return (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" /> Project Manager
          </Badge>
        )
      case 'employee':
        return (
          <Badge variant="outline" className="gap-1">
            <User className="h-3 w-3" /> Employee
          </Badge>
        )
    }
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
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined Date</TableHead>
              {isOwner && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.userId === currentUserId
              const initials = member.fullName
                ? member.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'U'

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatarUrl || undefined} alt={member.fullName} />
                        <AvatarFallback className="bg-primary/10 font-medium text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {member.fullName}
                          {isSelf && (
                            <span className="text-[10px] font-semibold text-muted-foreground border rounded px-1 py-0.2">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOwner && !isSelf ? (
                      <Select
                        value={member.role}
                        onValueChange={(val) => handleRoleChange(member.id, val as OrganizationRole)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="project_manager">Project Manager</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getRoleBadge(member.role)
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  {isOwner && (
                    <TableCell className="text-right">
                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(member.id, member.fullName)}
                          disabled={isPending}
                          title="Remove member"
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
