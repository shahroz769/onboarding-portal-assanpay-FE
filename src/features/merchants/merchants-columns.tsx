import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { DataTableColumnHeader } from '#/components/data-table'
import type { MerchantListItem, Priority } from '#/schemas/merchants.schema'
import {
  MERCHANT_STATUS_DISPLAY,
  ONBOARDING_STAGE_LABELS,
  PRIORITY_LABELS,
  BUSINESS_SCOPE_LABELS,
} from '#/schemas/merchants.schema'
import type { RoleType } from '#/types/auth'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysCount(createdAt: string, liveAt: string | null): number {
  const start = new Date(createdAt).getTime()
  const end = liveAt ? new Date(liveAt).getTime() : Date.now()
  return Math.max(0, Math.floor((end - start) / 86_400_000))
}



function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
    case 'In Progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'Pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
    case 'Suspended':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }
}



// ─── Column Factory ─────────────────────────────────────────────────────────

interface CreateColumnsOptions {
  userRole: RoleType
  onPriorityClick: (merchant: MerchantListItem) => void
  onDeleteClick: (merchant: MerchantListItem) => void
}

export function createMerchantColumns({
  userRole,
  onPriorityClick,
  onDeleteClick,
}: CreateColumnsOptions): ColumnDef<MerchantListItem>[] {
  const canEdit = userRole === 'admin' || userRole === 'supervisor'
  const canDelete = userRole === 'admin'

  return [
    // Select
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // Merchant ID
    {
      accessorKey: 'merchantNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Merchant ID" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">
          {row.getValue('merchantNumber')}
        </span>
      ),
      size: 120,
    },

    // Merchant Name
    {
      accessorKey: 'businessName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Merchant Name" />
      ),
      cell: ({ row }) => (
        <span className="max-w-50 truncate font-medium">
          {row.getValue('businessName')}
        </span>
      ),
      size: 200,
    },

    // Onboarding Stage
    {
      accessorKey: 'onboardingStage',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Onboarding Stage" />
      ),
      cell: ({ row }) => {
        const stage = row.getValue('onboardingStage') as string
        return (
          <Badge variant="secondary">
            {ONBOARDING_STAGE_LABELS[stage as keyof typeof ONBOARDING_STAGE_LABELS] ?? stage}
          </Badge>
        )
      },
      size: 160,
    },

    // Status (derived)
    {
      id: 'derivedStatus',
      accessorKey: 'onboardingStage',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const stage = row.original.onboardingStage
        const display = MERCHANT_STATUS_DISPLAY[stage]
        return (
          <Badge className={getStatusBadgeClasses(display)}>
            {display}
          </Badge>
        )
      },
      size: 120,
    },

    // Priority (clickable)
    {
      accessorKey: 'priority',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => {
        const merchant = row.original
        const priorityBadge = (
          <Badge
            variant="secondary"
            className="cursor-pointer transition-colors"
            onClick={canEdit ? () => onPriorityClick(merchant) : undefined}
          >
            {PRIORITY_LABELS[merchant.priority]}
          </Badge>
        )

        if (merchant.priorityNote) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>{priorityBadge}</TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{merchant.priorityNote}</p>
              </TooltipContent>
            </Tooltip>
          )
        }

        return priorityBadge
      },
      size: 100,
    },

    // Created At
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt') as string)
        return (
          <span className="text-sm text-muted-foreground">
            {format(date, 'MMM dd, yyyy h:mm a')}
          </span>
        )
      },
      size: 180,
    },

    // Currency
    {
      accessorKey: 'currency',
      header: 'Currency',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue('currency')}</span>
      ),
      enableSorting: false,
      size: 80,
    },

    // Business Scope
    {
      accessorKey: 'businessScope',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Business Scope" />
      ),
      cell: ({ row }) => {
        const scope = row.getValue('businessScope') as string
        return (
          <span className="text-sm text-muted-foreground">
            {BUSINESS_SCOPE_LABELS[scope as keyof typeof BUSINESS_SCOPE_LABELS] ?? scope}
          </span>
        )
      },
      size: 130,
    },

    // Days
    {
      id: 'days',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Days" />
      ),
      accessorFn: (row) => getDaysCount(row.createdAt, row.liveAt),
      cell: ({ row }) => {
        const days = getDaysCount(row.original.createdAt, row.original.liveAt)
        const isLive = row.original.liveAt !== null
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm tabular-nums">{days}</span>
            {isLive && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                Final
              </Badge>
            )}
          </div>
        )
      },
      size: 90,
    },

    // Actions
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const merchant = row.original
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" asChild>
                  <Link to="/merchants/$merchantId" params={{ merchantId: merchant.id }}>
                    <EyeIcon className="size-4" />
                    <span className="sr-only">View</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" asChild>
                    <Link to="/onboarding-form" search={{ merchantId: merchant.id }}>
                      <PencilIcon className="size-4" />
                      <span className="sr-only">Edit</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDeleteClick(merchant)}
                  >
                    <Trash2Icon className="size-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
      size: 100,
    },
  ]
}
