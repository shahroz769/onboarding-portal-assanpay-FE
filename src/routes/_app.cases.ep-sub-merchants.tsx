import { createFileRoute, Navigate } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { useAuth } from '#/features/auth/auth-client'
import { EpMerchantsTable } from '#/features/ep-sub-merchants/ep-merchants-table'
import {
  epMerchantsInfiniteQueryOptions,
  epMerchantsTableFilters,
} from '#/hooks/use-ep-sub-merchants-query'
import { epMerchantRouteSearchSchema } from '#/schemas/ep-sub-merchants.schema'
import { ROUTE_SKELETON_DELAY_MS } from '#/lib/route-pending'

export const Route = createFileRoute('/_app/cases/ep-sub-merchants')({
  staticData: {
    title: 'EP Sub-Merchants',
    subtitle: 'Trigger EP Sub-Merchant cases and track their status.',
    fitViewport: true,
  },
  validateSearch: epMerchantRouteSearchSchema,
  // The access guard lives in the component: a beforeLoad would make every
  // visit pending and flash the skeleton for pendingMinMs. The loader only
  // starts the list request while the skeleton shows, for users the guard
  // lets through; the table keeps its own loading and error states.
  loader: ({ context: { queryClient, auth }, location, preload }) => {
    if (preload || !auth.getSnapshot().user?.canManageEpCases) return
    const search = epMerchantRouteSearchSchema.safeParse(location.search)
    if (search.success) {
      void queryClient.prefetchInfiniteQuery(
        epMerchantsInfiniteQueryOptions(epMerchantsTableFilters(search.data)),
      )
    }
  },
  pendingMs: ROUTE_SKELETON_DELAY_MS,
  pendingComponent: EpMerchantsRoutePending,
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()

  if (!user?.canManageEpCases) {
    return <Navigate to="/cases/all-cases" replace />
  }

  return <EpMerchantsTable />
}

function EpMerchantsRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={3}
      filterWidths={[128, 116, 92]}
      actionWidth={168}
      columns={[
        { width: 300, kind: 'text', header: 'Merchant Name' },
        { width: 220, kind: 'text', header: 'Owner', cellWidth: 120 },
        { width: 120, kind: 'badge', header: 'Status', cellWidth: 64 },
        { width: 120, kind: 'badge', header: 'WordPress', cellWidth: 80 },
        { width: 300, kind: 'badge', header: 'EP Status', cellWidth: 160 },
        { width: 180, kind: 'date', header: 'Created At' },
        { width: 180, kind: 'date', header: 'Last Updated' },
        { width: 140, kind: 'actions', header: 'Actions' },
      ]}
    />
  )
}
