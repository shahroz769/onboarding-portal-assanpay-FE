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
      columnWidths={[40, 120, 200, 130, 80, 160, 120, 100, 180, 100]}
    />
  )
}
