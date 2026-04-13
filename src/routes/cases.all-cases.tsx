import { createFileRoute } from '@tanstack/react-router'
import { AppPage } from '#/components/app-page'

export const Route = createFileRoute('/cases/all-cases')({ component: App })

function App() {
  return <AppPage title="All Cases" />
}
