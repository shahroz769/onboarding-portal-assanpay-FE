import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/my-open-cases')({
  staticData: {
    title: 'My Open Cases',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
