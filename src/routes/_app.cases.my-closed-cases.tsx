import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/my-closed-cases')({
  staticData: {
    title: 'My Closed Cases',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
