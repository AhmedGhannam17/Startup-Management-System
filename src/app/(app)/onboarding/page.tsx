import type { Metadata } from 'next'
import { OnboardingForm } from '@/components/organization/onboarding-form'

export const metadata: Metadata = {
  title: 'Setup Organization',
}

export default function OnboardingPage() {
  return (
    <div className="py-6">
      <OnboardingForm />
    </div>
  )
}
