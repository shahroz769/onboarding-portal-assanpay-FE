import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
  staticData: {
    title: 'Dashboard',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
