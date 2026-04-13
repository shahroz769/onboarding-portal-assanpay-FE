import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/user-management/')({
  staticData: {
    title: 'User Management',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
