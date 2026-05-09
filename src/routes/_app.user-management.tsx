import { Outlet, createFileRoute } from '@tanstack/react-router'
import { requireRoleAccess } from '#/features/auth/route-guards'

export const Route = createFileRoute('/_app/user-management')({
  beforeLoad: ({ context }) => {
    requireRoleAccess(context.auth, ['agent'])
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
