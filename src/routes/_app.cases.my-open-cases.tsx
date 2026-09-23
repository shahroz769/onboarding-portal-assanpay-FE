import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { CasesTableComposed } from '#/features/cases/cases-table'
import { useCasesSearchActions } from '#/features/cases/cases-route-filters'
import { useAuth } from '#/features/auth/auth-client'
import {
  casesInfiniteQueryOptions,
  queuesQueryOptions,
} from '#/hooks/use-cases-query'
import { userDirectoryQueryOptions } from '#/hooks/use-users-query'
import { CASE_STATUSES, caseRouteSearchSchema } from '#/schemas/cases.schema'

const OPEN_CASE_STATUSES = CASE_STATUSES.filter(
  (status) => status !== 'closed' && status !== 'error',
)
const OPEN_CASES_STATUS_FILTER = OPEN_CASE_STATUSES.join(',')

export const Route = createFileRoute('/_app/cases/my-open-cases')({
  staticData: {
    title: 'My Open Cases',
    subtitle: 'Cases you currently own that are still in progress.',
    fitViewport: true,
  },
  validateSearch: caseRouteSearchSchema,
  pendingMs: 0,
  pendingComponent: CasesRoutePending,
  // Search params are read here instead of via loaderDeps: loaderDeps would
  // create a new pending match per keystroke and unmount the filter toolbar.
  loader: async ({ context, location }) => {
    const search = caseRouteSearchSchema.parse(location.search)
    const deps = {
      search: search.search,
      queueId: search.queueId,
      sortBy: search.sortBy,
      sortOrder: search.sortOrder,
    }

    void context.queryClient.prefetchQuery(queuesQueryOptions())
    void context.queryClient.prefetchQuery(userDirectoryQueryOptions())

    const userId = context.auth.getSnapshot().user?.id

    if (!userId) {
      return
    }

    void context.queryClient.prefetchInfiniteQuery(
      casesInfiniteQueryOptions({
        ...deps,
        ownerId: userId,
        status: OPEN_CASES_STATUS_FILTER,
        createdAtFrom: undefined,
        createdAtTo: undefined,
      }),
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const { setFilter, setFilters } = useCasesSearchActions(
    '/cases/my-open-cases',
  )
  const { user } = useAuth()

  return (
    <CasesTableComposed
      filters={{
        ...search,
        ownerId: user?.id,
        status: OPEN_CASES_STATUS_FILTER,
      }}
      setFilter={setFilter}
      setFilters={setFilters}
      hideOwnerFilter
      hideStatusFilter
    />
  )
}

function CasesRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={0}
      actionWidth={124}
      columns={[
        { width: 40, kind: 'checkbox' },
        { width: 160, kind: 'link', header: 'Case Number', cellWidth: 118 },
        { width: 200, kind: 'text', header: 'Merchant Name' },
        { width: 150, kind: 'link', header: 'Case Owner', cellWidth: 104 },
        { width: 130, kind: 'badge', header: 'Queue', cellWidth: 92 },
        { width: 160, kind: 'badge', header: 'Case Status', cellWidth: 78 },
        { width: 110, kind: 'badge', header: 'SLA', cellWidth: 64 },
        { width: 100, kind: 'badge', header: 'Priority', cellWidth: 64 },
        { width: 180, kind: 'date', header: 'Creation Date' },
        { width: 180, kind: 'date', header: 'Closed Date' },
        { width: 180, kind: 'date', header: 'Last Updated At' },
      ]}
    />
  )
}
