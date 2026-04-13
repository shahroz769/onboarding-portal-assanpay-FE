import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/')({
  staticData: {
    title: 'Cases',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
