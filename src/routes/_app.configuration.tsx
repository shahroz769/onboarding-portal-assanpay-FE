import { Outlet, createFileRoute } from '@tanstack/react-router'

import { requireAllowedRoles } from '#/features/auth/route-guards'

export const Route = createFileRoute('/_app/configuration')({
  beforeLoad: ({ context }) => {
    requireAllowedRoles(context.auth, ['super_admin', 'admin'])
  },
  staticData: {
    title: 'Configuration',
    subtitle: 'Manage portal-wide workflow and onboarding settings.',
    fitViewport: true,
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="-m-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-1">
      <Outlet />
    </div>
  )
}
