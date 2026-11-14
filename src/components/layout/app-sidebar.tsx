'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  FileText,
  CreditCard,
  Settings,
  PlusCircle,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrganizationContext } from '@/lib/organization/context'

interface AppSidebarProps {
  organizationContext: OrganizationContext | null
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Team',
    href: '/team',
    icon: Users,
  },
  {
    title: 'Org Settings',
    href: '/organization/settings',
    icon: Settings,
  },
  {
    title: 'Clients',
    href: '/clients',
    icon: Building2,
  },
  {
    title: 'Projects',
    href: '/projects',
    icon: Briefcase,
  },
  {
    title: 'Tasks',
    href: '/tasks',
    icon: CheckSquare,
  },
  {
    title: 'Quotations',
    href: '/quotations',
    icon: FileText,
  },
  {
    title: 'Payments',
    href: '/payments',
    icon: CreditCard,
  },
]

export function AppSidebar({ organizationContext }: AppSidebarProps) {
  const pathname = usePathname()
  const activeOrg = organizationContext?.organization

  return (
    <aside className="print-workspace-chrome flex h-screen w-64 flex-col border-r bg-card text-card-foreground">
      {/* Brand Header */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">U</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">UpWeGo</span>
        </Link>
      </div>

      {/* Active Organization Switcher / Display */}
      {activeOrg ? (
        <div className="border-b bg-muted/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                {activeOrg.name.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-semibold leading-none">{activeOrg.name}</p>
                <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                  {organizationContext.role.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b px-4 py-3">
          <Link
            href="/onboarding"
            className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
          >
            <PlusCircle className="h-4 w-4" />
            Create Organization
          </Link>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="border-t p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">UpWeGo Foundation</p>
        <p className="mt-0.5">Tasks · Quotations · Payments</p>
      </div>
    </aside>
  )
}
