import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createServerClient } from '@/lib/supabase/server'
import { AcceptInviteButton } from '@/components/team/accept-invite-button'

export const metadata: Metadata = {
  title: 'Organization Invitation',
}

interface InvitePageProps {
  params: Promise<{ token: string }>
}


async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const tokenHash = await hashToken(token)

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Query invitation details securely via RPC
  const { data: rpcRaw } = await supabase.rpc('get_invitation_by_token', {
    p_token_hash: tokenHash,
  } as unknown as never)

  const rpcData = rpcRaw as Array<{ organization_name: string; email: string; is_valid: boolean; status: string; role: string }> | null

  const invData = rpcData && rpcData.length > 0 ? rpcData[0] : null
  const orgName = invData?.organization_name || 'an organization'
  const isExpired = invData ? !invData.is_valid : false
  const isValid = invData && invData.status === 'pending' && !isExpired

  if (!invData || !isValid) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto mb-2">
            <AlertCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Invalid or Expired Invitation</CardTitle>
          <CardDescription>
            This invitation link is invalid, expired, or has already been used.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href="/login">Go to Sign In</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const redirectUrl = `/invite/${token}`

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-2">
          <Building2 className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">You&apos;re Invited!</CardTitle>
        <CardDescription>
          You have been invited to join <strong className="text-foreground font-semibold">{orgName}</strong> on StartupHub.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-2 text-sm bg-muted/30">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Organization</span>
            <span className="font-semibold">{orgName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned Role</span>
            <span className="font-semibold capitalize">{invData.role.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invited Email</span>
            <span className="font-mono text-xs">{invData.email}</span>
          </div>
        </div>

        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Signed in as <strong>{user.email}</strong></span>
            </div>
            <AcceptInviteButton token={token} />
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-center text-muted-foreground">
              Sign in or create an account to accept this invitation.
            </p>
            <div className="grid gap-2">
              <Button asChild className="w-full">
                <Link href={`/login?redirectedFrom=${encodeURIComponent(redirectUrl)}`}>
                  Sign in to Accept <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/register?redirectedFrom=${encodeURIComponent(redirectUrl)}`}>
                  Create Account
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
