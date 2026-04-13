import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cases')({ component: App })

function App() {
  return <Outlet />
}
