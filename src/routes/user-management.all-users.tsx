import { createFileRoute } from '@tanstack/react-router'
import { AppPage } from '#/components/app-page'

export const Route = createFileRoute('/user-management/all-users')({
  component: App,
})

function App() {
  return <AppPage title="All Users" />
}
