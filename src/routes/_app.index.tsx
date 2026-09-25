import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'

import { Dashboard } from '#/features/dashboard/dashboard'
import { DashboardSkeleton } from '#/features/dashboard/dashboard-skeleton'
import { loadDashboardCharts } from '#/features/dashboard/load-dashboard-charts'
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
  // Data is fetched by Dashboard itself (it renders its own skeleton). The
  // loader only starts the charts code chunk so it downloads alongside the
  // data. A failed chunk load resurfaces through the lazy boundary.
  loader: () => {
    loadDashboardCharts().catch(() => {})
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
