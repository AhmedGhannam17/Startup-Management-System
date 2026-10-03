'use client'

import { useState, useTransition } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { acceptInvitation } from '@/app/actions/invitation'

interface AcceptInviteButtonProps {
  token: string
}

export function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvitation(token)
      if (result && !result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button onClick={handleAccept} className="w-full" disabled={isPending}>
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        {isPending ? 'Joining Organization…' : 'Accept Invitation & Join'}
      </Button>
    </div>
  )
}
