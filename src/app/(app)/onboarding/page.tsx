import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Organization Onboarding',
}

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h2 className="text-3xl font-bold tracking-tight">Organization Setup</h2>
        <p className="text-muted-foreground">
          Welcome to StartupHub! This is the entry point for setting up your agency or business workspace.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle>Welcome to Organization Onboarding</CardTitle>
          <CardDescription>
            StartupHub is multi-tenant by design. In future phases, you will create or join an organization to start collaborating with your team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <h4 className="font-semibold text-sm">What happens during organization onboarding?</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span><strong>Business Identity:</strong> Configure your business name, logo, contact info, and default currency.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span><strong>Team Members:</strong> Invite project managers and employees with role-based access control.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span><strong>Data Isolation:</strong> Ensure all clients, projects, quotations, and financial records belong securely to your organization.</span>
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
          <Button disabled title="Organization setup phase will be implemented in the next development task">
            Start Setup (Coming in Phase 2)
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
