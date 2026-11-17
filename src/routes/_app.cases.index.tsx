import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/')({
  staticData: {
    title: 'Cases',
  },
  // Redirects before anything renders. A <Navigate> component made this route
  // pending first (its component chunk, then the skeleton's minimum display
  // time) and only then started All Cases.
  beforeLoad: () => {
    throw redirect({ to: '/cases/all-cases', replace: true })
  },
})
