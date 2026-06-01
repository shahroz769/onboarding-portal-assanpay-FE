import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuration/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/configuration/limits-and-mdr" replace />
}
