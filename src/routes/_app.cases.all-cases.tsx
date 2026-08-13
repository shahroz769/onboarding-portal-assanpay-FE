import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { CasesTableComposed } from '#/features/cases/cases-table'
import { useCasesSearchActions } from '#/features/cases/cases-route-filters'
import {
  casesInfiniteQueryOptions,
  queuesQueryOptions,
} from '#/hooks/use-cases-query'
import { usersQueryOptions } from '#/hooks/use-users-query'
import { caseRouteSearchSchema } from '#/schemas/cases.schema'

export const Route = createFileRoute('/_app/cases/all-cases')({
  staticData: {
    title: 'All Cases',
    subtitle: 'Review and manage all onboarding cases.',
  },
  validateSearch: caseRouteSearchSchema,
  loaderDeps: ({ search }) => ({
    search: search.search,
    queueId: search.queueId,
    ownerId: search.ownerId,
    status: search.status,
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
  }),
  pendingMs: 0,
  pendingComponent: CasesRoutePending,
  loader: async ({ context, deps }) => {
    void context.queryClient.prefetchQuery(queuesQueryOptions())
    void context.queryClient.prefetchQuery(usersQueryOptions())

    void context.queryClient.prefetchInfiniteQuery(
      casesInfiniteQueryOptions({
        ...deps,
        createdAtFrom: undefined,
        createdAtTo: undefined,
      }),
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const { setFilter, setFilters } = useCasesSearchActions('/cases/all-cases')

  return (
    <CasesTableComposed
      filters={search}
      setFilter={setFilter}
      setFilters={setFilters}
    />
  )
}

function CasesRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={2}
      filterWidths={[96, 128]}
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
