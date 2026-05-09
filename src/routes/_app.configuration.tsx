import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuration')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
