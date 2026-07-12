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
    priority: search.priority,
    businessScope: search.businessScope,
    currency: search.currency,
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
  }),
  pendingMs: 0,
  pendingComponent: MerchantsRoutePending,
  loader: async ({ context, deps }) => {
    void context.queryClient.prefetchInfiniteQuery(
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
      filterCount={2}
      filterWidths={[104, 96]}
      actionWidth={148}
      columns={[
        { width: 40, kind: 'checkbox' },
        { width: 120, kind: 'mono', header: 'Merchant ID', cellWidth: 78 },
        { width: 200, kind: 'text', header: 'Merchant Name' },
        { width: 130, kind: 'text', header: 'Business Scope', cellWidth: 92 },
        { width: 80, kind: 'text', header: 'Currency', cellWidth: 36 },
        { width: 120, kind: 'badge', header: 'Status', cellWidth: 88 },
        { width: 100, kind: 'badge', header: 'Priority', cellWidth: 64 },
        { width: 180, kind: 'date', header: 'Created At' },
        { width: 100, kind: 'actions', header: 'Actions' },
      ]}
    />
  )
}
