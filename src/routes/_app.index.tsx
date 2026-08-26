import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'

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
  search: {
    // Keep the dashboard's 30-day default out of the URL while preserving
    // every other range and any custom date parameters.
    middlewares: [stripSearchParams({ range: '30d' })],
  },
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
