import { createFileRoute } from '@tanstack/react-router'
import { AppPage } from '#/components/app-page'

export const Route = createFileRoute('/user-management/user-creation')({
  component: App,
})

function App() {
  return <AppPage title="User Creation" />
}
