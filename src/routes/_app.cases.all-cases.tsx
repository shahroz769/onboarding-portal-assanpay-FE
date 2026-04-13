import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/all-cases')({
  staticData: {
    title: 'All Cases',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
