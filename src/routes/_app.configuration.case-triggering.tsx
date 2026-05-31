import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuration/case-triggering')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/configuration" replace />
}
