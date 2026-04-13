import { createFileRoute } from '@tanstack/react-router'
import { AppPage } from '#/components/app-page'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return <AppPage title="Dashboard" />
}
