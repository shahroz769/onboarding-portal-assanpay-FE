import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/merchants')({
  staticData: {
    title: 'Merchants',
  },
  component: RouteComponent,
})

function RouteComponent() {
  return null
}
