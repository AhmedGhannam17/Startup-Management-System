'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inviteMember } from '@/app/actions/invitation'

interface InviteMemberDialogProps {
  isManager: boolean
}

export function InviteMemberDialog({ isManager }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [role, setRole] = useState<string>('employee')

  if (!isManager) return null

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInviteUrl(null)
    const formData = new FormData(event.currentTarget)
    formData.set('role', role)

    startTransition(async () => {
      const result = await inviteMember(formData)
      if (!result.success) {
        setError(result.error)
      } else if (result.data?.inviteUrl) {
        setInviteUrl(result.data.inviteUrl)
      }
    })
  }

  function handleCopy() {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleReset() {
    setInviteUrl(null)
    setError(null)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Team Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation link to add a new member to your organization workspace.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              Invitation link generated successfully!
            </div>
            <div className="space-y-2">
              <Label>Shareable Invitation Link</Label>
              <div className="flex items-center gap-2">
                <Input value={inviteUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This link will expire in 7 days. Anyone with this link can join as the assigned role.
              </p>
            </div>
            <Button onClick={handleReset} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="recipientName">Recipient Name (Optional)</Label>
              <Input
                id="recipientName"
                name="recipientName"
                placeholder="Jane Smith"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jane@company.com"
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee (Basic Access)</SelectItem>
                  <SelectItem value="project_manager">Project Manager (Team & Operational Admin)</SelectItem>
                  <SelectItem value="owner">Owner (Full Organization Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Generating Invitation…' : 'Generate Invitation Link'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
