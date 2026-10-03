import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { UserNav } from '@/components/layout/user-nav'
import { Badge } from '@/components/ui/badge'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const orgContext = await getActiveOrganizationContext()

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Permanent Sidebar for Desktop */}
      <AppSidebar organizationContext={orgContext} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight text-muted-foreground">
              StartupHub Workspace
            </h1>
            {orgContext?.organization && (
              <Badge variant="outline" className="text-xs capitalize font-normal">
                {orgContext.organization.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <UserNav
              user={user}
              orgName={orgContext?.organization.name}
              role={orgContext?.role}
            />
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
