import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/user-management')({
  component: App,
})

function App() {
  return <Outlet />
}
