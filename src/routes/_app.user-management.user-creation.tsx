import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/user-management/user-creation')({
  staticData: {
    title: 'User Creation',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
