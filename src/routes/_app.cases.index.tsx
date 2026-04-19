import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/')({
  staticData: {
    title: 'Cases',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/cases/all-cases" replace />
}
