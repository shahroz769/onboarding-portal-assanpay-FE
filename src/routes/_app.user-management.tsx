import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '#/stores/auth.store'

export const Route = createFileRoute('/_app/user-management')({
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    if (user?.roleType === 'employee') {
      throw redirect({ to: '/' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
