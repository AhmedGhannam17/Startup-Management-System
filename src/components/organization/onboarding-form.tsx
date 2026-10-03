'use client'

import { useState, useTransition } from 'react'
import { Loader2, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createOrganization } from '@/app/actions/organization'

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await createOrganization(formData)
      if (result && !result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <Card className="w-full max-w-xl mx-auto shadow-sm">
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
          <Building2 className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">Create Your Organization</CardTitle>
        <CardDescription>
          Set up your business workspace to manage team members, clients, projects, quotations, and payments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Business / Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Acme Digital Agency"
                required
                disabled={isPending}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Business Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="contact@acme.com"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  disabled={isPending}
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
                  placeholder="https://acme.com"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Input
                  id="currency"
                  name="currency"
                  type="text"
                  defaultValue="USD"
                  placeholder="USD, EUR, GBP, INR..."
                  required
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                type="text"
                placeholder="123 Market St, Suite 400, San Francisco, CA"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessDescription">Business Description</Label>
              <Input
                id="businessDescription"
                name="businessDescription"
                type="text"
                placeholder="Full-service digital design and software development agency."
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">Tax / Business Registration ID</Label>
              <Input
                id="taxId"
                name="taxId"
                type="text"
                placeholder="EIN / VAT / Tax ID (Optional)"
                disabled={isPending}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? 'Creating Organization…' : 'Create Organization Workspace'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
