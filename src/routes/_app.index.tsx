import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Dashboard, DashboardSkeleton } from '#/features/dashboard/dashboard'
import { dashboardQueryOptions } from '#/hooks/use-dashboard-query'
import { dashboardRouteSearchSchema } from '#/schemas/dashboard.schema'
import type { DashboardRouteSearch } from '#/schemas/dashboard.schema'

export const Route = createFileRoute('/_app/')({
  staticData: {
    title: 'Dashboard',
    subtitle: 'Operations overview across cases, merchants, and queues.',
  },
  validateSearch: dashboardRouteSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(dashboardQueryOptions(deps))
  },
  pendingComponent: DashboardSkeleton,
  pendingMs: 0,
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  function handleChange(next: Partial<DashboardRouteSearch>) {
    void navigate({
      to: '/',
      search: (prev) => {
        const merged = { ...prev, ...next }
        if (merged.range !== 'custom') {
          merged.from = undefined
          merged.to = undefined
        }
        return merged
      },
      replace: true,
    })
  }

  return <Dashboard search={search} onChange={handleChange} />
}
