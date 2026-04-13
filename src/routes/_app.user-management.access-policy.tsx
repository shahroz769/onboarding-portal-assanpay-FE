import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/user-management/access-policy')({
  staticData: {
    title: 'Access Policy',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
