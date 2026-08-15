import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/user-management/')({
  staticData: {
    title: 'User Management',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/user-management/all-users" replace />
}
