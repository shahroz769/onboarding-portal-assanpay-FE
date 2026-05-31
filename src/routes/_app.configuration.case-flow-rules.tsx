import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuration/case-flow-rules')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/configuration" replace />
}
