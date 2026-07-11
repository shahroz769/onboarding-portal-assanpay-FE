import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireAllowedRoles } from '#/features/auth/route-guards'

export const Route = createFileRoute('/_app/user-management')({
  staticData: {
    title: 'User Management',
    subtitle: 'Manage employees, roles, and queue access.',
  },
  beforeLoad: ({ context }) => {
    requireAllowedRoles(context.auth, ['super_admin', 'admin'])
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
