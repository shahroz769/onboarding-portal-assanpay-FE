import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/onboarding-form')({
  component: OnboardingFormRoute,
})

function OnboardingFormRoute() {
  return <Outlet />
}
