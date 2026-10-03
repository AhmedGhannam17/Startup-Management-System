import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { SettingsForm } from '@/components/organization/settings-form'

export const metadata: Metadata = {
  title: 'Organization Settings',
}

export default async function SettingsPage() {
  const context = await getActiveOrganizationContext()

  if (!context) {
    redirect('/onboarding')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Organization Profile</h2>
        <p className="text-muted-foreground">
          Manage identity, contact details, and default currency for {context.organization.name}.
        </p>
      </div>

      <SettingsForm organization={context.organization} isOwner={context.isOwner} />
    </div>
  )
}
