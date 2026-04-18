import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { MerchantsTableComposed } from '#/features/merchants/merchants-table'
import { MERCHANT_SORTABLE_COLUMNS } from '#/schemas/merchants.schema'

const merchantSearchSchema = z.object({
  search: z.string().optional(),
  onboardingStage: z.string().optional(),
  priority: z.string().optional(),
  businessScope: z.string().optional(),
  currency: z.string().optional(),
  sortBy: z.enum(MERCHANT_SORTABLE_COLUMNS).optional().default('merchantNumber'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const Route = createFileRoute('/_app/merchants')({
  staticData: {
    title: 'Merchants',
    subtitle: 'Manage and track merchant onboarding progress.',
  },
  validateSearch: merchantSearchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  return <MerchantsTableComposed />
}
