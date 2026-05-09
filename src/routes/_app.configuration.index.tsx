import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuration/')({
  staticData: {
    title: 'Configuration',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/configuration/limits-and-mdr" replace />
}
