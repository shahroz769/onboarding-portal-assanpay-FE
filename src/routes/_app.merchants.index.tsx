import { createFileRoute } from '@tanstack/react-router'

import { DataTableRouteSkeleton } from '#/components/data-table/data-table-route-skeleton'
import { MerchantsTableComposed } from '#/features/merchants/merchants-table'
import { merchantRouteSearchSchema } from '#/schemas/merchants.schema'

export const Route = createFileRoute('/_app/merchants/')({
  staticData: {
    title: 'Merchants',
    subtitle: 'Manage and track merchant onboarding progress.',
    fitViewport: true,
  },
  validateSearch: merchantRouteSearchSchema,
  pendingMs: 0,
  pendingComponent: MerchantsRoutePending,
  component: RouteComponent,
})

function RouteComponent() {
  return <MerchantsTableComposed />
}

function MerchantsRoutePending() {
  return (
    <DataTableRouteSkeleton
      filterCount={3}
      filterWidths={[104, 104, 96]}
      actionWidth={148}
      columns={[
        { width: 40, kind: 'checkbox' },
        { width: 300, kind: 'text', header: 'Merchant Name' },
        { width: 220, kind: 'text', header: 'Owner', cellWidth: 120 },
        { width: 120, kind: 'badge', header: 'Status', cellWidth: 88 },
        { width: 100, kind: 'badge', header: 'Priority', cellWidth: 64 },
        { width: 110, kind: 'text', header: 'Open Cases', cellWidth: 24 },
        { width: 180, kind: 'date', header: 'Created At' },
        { width: 130, kind: 'date', header: 'Went Live' },
        { width: 180, kind: 'date', header: 'Last Updated' },
        { width: 140, kind: 'actions', header: 'Actions' },
      ]}
    />
  )
}
