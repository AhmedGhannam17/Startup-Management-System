import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Building2,
  Users,
  Briefcase,
  CreditCard,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const orgContext = await getActiveOrganizationContext()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  // Fetch count of team members if org is active
  let memberCount = 0
  if (orgContext?.organization) {
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgContext.organization.id)

    memberCount = count || 0
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back, {userName}!</h2>
          <p className="text-muted-foreground">
            {orgContext?.organization
              ? `Operational overview for ${orgContext.organization.name}.`
              : 'Setup your organization workspace to begin.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {orgContext?.organization ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/team">
                <Users className="mr-2 h-4 w-4" />
                Manage Team ({memberCount})
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/onboarding">
                <Building2 className="mr-2 h-4 w-4" />
                Create Organization
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Overview Stat Shells */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCount}</div>
            <p className="text-xs text-muted-foreground">
              {orgContext?.organization ? 'Active team members' : 'No organization setup'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Module ready for Phase 3</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Module ready for Phase 3</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orgContext?.organization?.currency || 'USD'} $0.00
            </div>
            <p className="text-xs text-muted-foreground">Quotations & Payments shell</p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Status & System Info */}
      <div className="grid gap-6 md:grid-cols-2">
        {orgContext?.organization ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  {orgContext.organization.name}
                </CardTitle>
                <Badge variant="default" className="capitalize">
                  Role: {orgContext.role.replace('_', ' ')}
                </Badge>
              </div>
              <CardDescription>Active organization workspace details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-semibold">{orgContext.organization.currency}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Business Email</span>
                <span className="font-medium">{orgContext.organization.email || 'Not configured'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Website</span>
                <span className="font-medium">{orgContext.organization.website || 'Not configured'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created Date</span>
                <span className="font-medium">
                  {new Date(orgContext.organization.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-lg text-amber-700 dark:text-amber-400">
                No Organization Configured
              </CardTitle>
              <CardDescription>
                StartupHub requires an organization to manage team members and business data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Create your agency workspace to begin inviting project managers and employees.
              </p>
              <Button asChild className="w-full">
                <Link href="/onboarding">
                  Create Organization <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Security & Access Control
            </CardTitle>
            <CardDescription>
              Organization data isolation enforced via PostgreSQL Row Level Security (RLS).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Authenticated User</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Multi-tenant RLS</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Enforced</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role Capabilities</span>
              <span className="font-medium capitalize">{orgContext?.role || 'None'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
