import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/user-management/all-users')({
  staticData: {
    title: 'All Users',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
