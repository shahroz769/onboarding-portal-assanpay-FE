import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { Skeleton } from '#/components/ui/skeleton'
import { CasesTableComposed } from '#/features/cases/cases-table'
import { casesInfiniteQueryOptions } from '#/hooks/use-cases-query'
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
  pendingMinMs: 250,
  pendingComponent: CasesRoutePending,
  loader: async ({ context, deps }) => {
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
  return <CasesTableComposed />
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
        columnWidths={[40, 160, 200, 130, 120, 100, 150, 180, 180, 180]}
      />
    </>
  )
}
