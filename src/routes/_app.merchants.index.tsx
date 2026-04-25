import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { MerchantsTableComposed } from '#/features/merchants/merchants-table'
import { merchantsInfiniteQueryOptions } from '#/hooks/use-merchants-query'
import { merchantRouteSearchSchema } from '#/schemas/merchants.schema'

export const Route = createFileRoute('/_app/merchants/')({
  staticData: {
    title: 'Merchants',
    subtitle: 'Manage and track merchant onboarding progress.',
  },
  validateSearch: merchantRouteSearchSchema,
  loaderDeps: ({ search }) => ({
    search: search.search,
    onboardingStage: search.onboardingStage,
    priority: search.priority,
    businessScope: search.businessScope,
    currency: search.currency,
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
  }),
  pendingMs: 0,
  pendingComponent: MerchantsRoutePending,
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureInfiniteQueryData(
      merchantsInfiniteQueryOptions({
        ...deps,
        createdAtFrom: undefined,
        createdAtTo: undefined,
      }),
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <MerchantsTableComposed />
}

function MerchantsRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={3}
      filterWidths={[88, 104, 96]}
      actionWidth={148}
      columns={[
        { width: 40, kind: 'checkbox' },
        { width: 120, kind: 'mono', headerWidth: 88, cellWidth: 78 },
        { width: 200, kind: 'text', headerWidth: 128 },
        { width: 130, kind: 'text', headerWidth: 108, cellWidth: 92 },
        { width: 80, kind: 'text', headerWidth: 64, cellWidth: 36 },
        { width: 160, kind: 'badge', headerWidth: 132, cellWidth: 112 },
        { width: 120, kind: 'badge', headerWidth: 56, cellWidth: 88 },
        { width: 100, kind: 'badge', headerWidth: 68, cellWidth: 64 },
        { width: 180, kind: 'date', headerWidth: 84 },
        { width: 100, kind: 'actions', headerWidth: 56 },
      ]}
    />
  )
}
