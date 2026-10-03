'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateOrganization } from '@/app/actions/organization'
import type { Organization } from '@/lib/organization/context'

interface SettingsFormProps {
  organization: Organization
  isOwner: boolean
}

export function SettingsForm({ organization, isOwner }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isOwner) return

    setError(null)
    setSuccess(null)
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await updateOrganization(formData)
      if (!result.success) {
        setError(result.error)
      } else {
        setSuccess(result.message || 'Settings updated successfully')
      }
    })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">Organization Settings</CardTitle>
        <CardDescription>
          {isOwner
            ? 'Manage your organization profile, contact info, and business settings.'
            : 'View organization details. Only the Organization Owner can modify settings.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={organization.name}
                required
                disabled={!isOwner || isPending}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Business Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={organization.email || ''}
                  disabled={!isOwner || isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={organization.phone || ''}
                  disabled={!isOwner || isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  defaultValue={organization.website || ''}
                  disabled={!isOwner || isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency Code</Label>
                <Input
                  id="currency"
                  name="currency"
                  defaultValue={organization.currency}
                  required
                  disabled={!isOwner || isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                defaultValue={organization.address || ''}
                disabled={!isOwner || isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessDescription">Business Description</Label>
              <Input
                id="businessDescription"
                name="businessDescription"
                defaultValue={organization.business_description || ''}
                disabled={!isOwner || isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">Tax / Business ID</Label>
              <Input
                id="taxId"
                name="taxId"
                defaultValue={organization.tax_id || ''}
                disabled={!isOwner || isPending}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              <span>{success}</span>
            </div>
          )}

          {isOwner && (
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
