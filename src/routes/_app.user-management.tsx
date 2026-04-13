import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/user-management')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
