import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { MerchantOnboardingForm } from '#/features/onboarding/merchant-onboarding-form'

export const Route = createFileRoute('/onboarding-form')({
  component: OnboardingFormRoute,
})

function OnboardingFormRoute() {
  const [isSubmitted, setIsSubmitted] = useState(false)

  return (
    <main className="min-h-svh bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        {!isSubmitted ? (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Merchant Onboarding</h1>
            <p className="mt-2 text-muted-foreground">
              Complete the form below to submit your merchant application
            </p>
          </div>
        ) : null}
        <MerchantOnboardingForm onSubmittedChange={setIsSubmitted} />
      </div>
    </main>
  )
}
