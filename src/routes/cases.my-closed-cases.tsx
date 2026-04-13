import { createFileRoute } from '@tanstack/react-router'
import { AppPage } from '#/components/app-page'

export const Route = createFileRoute('/cases/my-closed-cases')({
  component: App,
})

function App() {
  return <AppPage title="My Closed Cases" />
}
