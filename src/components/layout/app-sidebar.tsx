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
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
  badge?: string
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Onboarding',
    href: '/onboarding',
    icon: PlusCircle,
    badge: 'Setup',
  },
  {
    title: 'Clients',
    href: '/clients',
    icon: Users,
    disabled: true,
  },
  {
    title: 'Projects',
    href: '/projects',
    icon: Briefcase,
    disabled: true,
  },
  {
    title: 'Tasks',
    href: '/tasks',
    icon: CheckSquare,
    disabled: true,
  },
  {
    title: 'Quotations',
    href: '/quotations',
    icon: FileText,
    disabled: true,
  },
  {
    title: 'Payments',
    href: '/payments',
    icon: CreditCard,
    disabled: true,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    disabled: true,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card text-card-foreground">
      {/* Brand Header */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">S</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">StartupHub</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60 cursor-not-allowed"
                  title="Coming soon in upcoming development phases"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground/50 border border-border/50 rounded px-1.5 py-0.5">
                    Soon
                  </span>
                </div>
              )
            }

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
        <p className="font-medium text-foreground">StartupHub Foundation v0.1</p>
        <p className="mt-0.5">SaaS Agency Operating System</p>
      </div>
    </aside>
  )
}
