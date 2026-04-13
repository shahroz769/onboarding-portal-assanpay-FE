import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
