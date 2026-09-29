import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'

import { Dashboard } from '#/features/dashboard/dashboard'
import { DashboardSkeleton } from '#/features/dashboard/dashboard-skeleton'
import { loadDashboardCharts } from '#/features/dashboard/load-dashboard-charts'
import {
  awaitingPhysicalAgreementsInfiniteQueryOptions,
  caseWorkloadQueryOptions,
  dashboardQueryOptions,
  pendingPortalMidsInfiniteQueryOptions,
} from '#/hooks/use-dashboard-query'
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
  // Starts every dashboard request and the charts code chunk together as
  // navigation begins, instead of the lists waiting for the summary to render
  // them. Nothing is awaited: Dashboard shows its own skeleton and error
  // states, and range changes refetch from the component (loaderDeps would
  // swap the kept previous range for the route skeleton). A failed chunk load
  // resurfaces through the lazy boundary.
  loader: ({ context: { queryClient }, location, preload }) => {
    loadDashboardCharts().catch(() => {})
    if (preload) return
    // Loaders get the raw search; this is the same parse validateSearch runs,
    // so the key matches the one Dashboard reads.
    const search = dashboardRouteSearchSchema.safeParse(location.search)
    if (search.success) {
      void queryClient.prefetchQuery(dashboardQueryOptions(search.data))
    }
    void queryClient.prefetchQuery(caseWorkloadQueryOptions())
    void queryClient.prefetchInfiniteQuery(
      pendingPortalMidsInfiniteQueryOptions(),
    )
    void queryClient.prefetchInfiniteQuery(
      awaitingPhysicalAgreementsInfiniteQueryOptions(),
    )
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
