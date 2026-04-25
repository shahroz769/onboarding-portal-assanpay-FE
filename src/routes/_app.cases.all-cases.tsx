import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { Skeleton } from '#/components/ui/skeleton'
import { CasesTableComposed } from '#/features/cases/cases-table'
import { useCasesSearchActions } from '#/features/cases/cases-route-filters'
import {
  casesInfiniteQueryOptions,
  queuesQueryOptions,
  usersQueryOptions,
} from '#/hooks/use-cases-query'
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

    await context.queryClient.ensureInfiniteQueryData(
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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('page-header-actions'))
  }, [])

  return (
    <>
      {portalTarget
        ? createPortal(<Skeleton className="h-9 w-50" />, portalTarget)
        : null}
      <DataTableRouteSkeleton
        filterCount={2}
        filterWidths={[96, 128]}
        actionWidth={124}
        columns={[
          { width: 40, kind: 'checkbox' },
          { width: 160, kind: 'link', headerWidth: 112, cellWidth: 118 },
          { width: 200, kind: 'text', headerWidth: 128 },
          { width: 130, kind: 'badge', headerWidth: 52, cellWidth: 92 },
          { width: 120, kind: 'badge', headerWidth: 96, cellWidth: 78 },
          { width: 100, kind: 'badge', headerWidth: 56, cellWidth: 64 },
          { width: 150, kind: 'link', headerWidth: 84, cellWidth: 104 },
          { width: 180, kind: 'date', headerWidth: 104 },
          { width: 180, kind: 'date', headerWidth: 92 },
          { width: 180, kind: 'date', headerWidth: 124 },
        ]}
      />
    </>
  )
}
