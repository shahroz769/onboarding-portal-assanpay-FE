import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { MerchantsTableComposed } from '#/features/merchants/merchants-table'
import { merchantsTableQueryOptions } from '#/hooks/use-merchants-query'
import { merchantRouteSearchSchema } from '#/schemas/merchants.schema'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/merchants/')({
  staticData: {
    title: 'Merchants',
    subtitle: 'Manage and track merchant onboarding progress.',
    fitViewport: true,
  },
  validateSearch: merchantRouteSearchSchema,
  // Starts the list request as navigation begins, so it runs while the route
  // skeleton is held for its minimum display time instead of after it. Not
  // awaited: the table keeps its own loading and error states. Loaders get the
  // raw search; this is the same parse validateSearch runs, so the key matches.
  loader: ({ context: { queryClient }, location, preload }) => {
    if (preload) return
    const search = merchantRouteSearchSchema.safeParse(location.search)
    if (search.success) {
      void queryClient.prefetchInfiniteQuery(
        merchantsTableQueryOptions(search.data),
      )
    }
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: MerchantsRoutePending,
  component: RouteComponent,
})

function RouteComponent() {
  return <MerchantsTableComposed />
}

function MerchantsRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={4}
      filterWidths={[104, 104, 96, 112]}
      actionWidth={148}
      columns={[
        { width: 40, kind: 'checkbox' },
        { width: 300, kind: 'text', header: 'Merchant Name' },
        { width: 220, kind: 'text', header: 'Owner', cellWidth: 120 },
        { width: 120, kind: 'badge', header: 'Status', cellWidth: 88 },
        { width: 100, kind: 'badge', header: 'Priority', cellWidth: 64 },
        { width: 110, kind: 'text', header: 'Open Cases', cellWidth: 24 },
        { width: 280, kind: 'badge', header: 'EP Status', cellWidth: 88 },
        { width: 180, kind: 'date', header: 'Created At' },
        { width: 130, kind: 'date', header: 'Went Live' },
        { width: 180, kind: 'date', header: 'Last Updated' },
        { width: 140, kind: 'actions', header: 'Actions' },
      ]}
    />
  )
}
