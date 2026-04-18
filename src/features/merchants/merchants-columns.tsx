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
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import type { MerchantListItem } from '#/schemas/merchants.schema'
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
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort: (columnId: string) => void
  selectedIds: Set<string>
  allIds: string[]
  onSelectRow: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onPriorityClick: (merchant: MerchantListItem) => void
  onDeleteClick: (merchant: MerchantListItem) => void
}

function getSortDirection(
  columnId: string,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
): 'asc' | 'desc' | false {
  if (sortBy !== columnId) return false
  return sortOrder ?? false
}

export function createMerchantColumns({
  userRole,
  sortBy,
  sortOrder,
  onSort,
  selectedIds,
  allIds,
  onSelectRow,
  onSelectAll,
  onPriorityClick,
  onDeleteClick,
}: CreateColumnsOptions): DataTableColumnDef<MerchantListItem>[] {
  const canEdit = userRole === 'admin' || userRole === 'supervisor'
  const canDelete = userRole === 'admin'

  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const isSomeSelected = !isAllSelected && allIds.some((id) => selectedIds.has(id))

  return [
    // Select
    {
      id: 'select',
      header: (
        <Checkbox
          checked={isAllSelected || (isSomeSelected && 'indeterminate')}
          onCheckedChange={(value) => onSelectAll(!!value)}
          aria-label="Select all"
        />
      ),
      cell: (merchant) => (
        <Checkbox
          checked={selectedIds.has(merchant.id)}
          onCheckedChange={(value) => onSelectRow(merchant.id, !!value)}
          aria-label="Select row"
        />
      ),
      width: 40,
    },

    // Merchant ID
    {
      id: 'merchantNumber',
      header: (
        <DataTableColumnHeader
          title="Merchant ID"
          sortDirection={getSortDirection('merchantNumber', sortBy, sortOrder)}
          onSort={() => onSort('merchantNumber')}
        />
      ),
      cell: (merchant) => (
        <span className="font-mono text-sm tabular-nums">
          {merchant.merchantNumber}
        </span>
      ),
      width: 120,
    },

    // Merchant Name
    {
      id: 'businessName',
      header: (
        <DataTableColumnHeader
          title="Merchant Name"
          sortDirection={getSortDirection('businessName', sortBy, sortOrder)}
          onSort={() => onSort('businessName')}
        />
      ),
      cell: (merchant) => (
        <span className="max-w-50 truncate font-medium">
          {merchant.businessName}
        </span>
      ),
      width: 200,
    },

    // Onboarding Stage
    {
      id: 'onboardingStage',
      header: (
        <DataTableColumnHeader
          title="Onboarding Stage"
          sortDirection={getSortDirection('onboardingStage', sortBy, sortOrder)}
          onSort={() => onSort('onboardingStage')}
        />
      ),
      cell: (merchant) => (
        <Badge variant="secondary">
          {ONBOARDING_STAGE_LABELS[merchant.onboardingStage]}
        </Badge>
      ),
      width: 160,
    },

    // Status (derived)
    {
      id: 'status',
      header: (
        <DataTableColumnHeader
          title="Status"
          sortDirection={getSortDirection('status', sortBy, sortOrder)}
          onSort={() => onSort('status')}
        />
      ),
      cell: (merchant) => {
        const display = MERCHANT_STATUS_DISPLAY[merchant.onboardingStage]
        return (
          <Badge className={getStatusBadgeClasses(display)}>
            {display}
          </Badge>
        )
      },
      width: 120,
    },

    // Priority (clickable)
    {
      id: 'priority',
      header: (
        <DataTableColumnHeader
          title="Priority"
          sortDirection={getSortDirection('priority', sortBy, sortOrder)}
          onSort={() => onSort('priority')}
        />
      ),
      cell: (merchant) => {
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
      width: 100,
    },

    // Created At
    {
      id: 'createdAt',
      header: (
        <DataTableColumnHeader
          title="Created At"
          sortDirection={getSortDirection('createdAt', sortBy, sortOrder)}
          onSort={() => onSort('createdAt')}
        />
      ),
      cell: (merchant) => {
        const date = new Date(merchant.createdAt)
        return (
          <span className="text-sm text-muted-foreground">
            {format(date, 'MMM dd, yyyy h:mm a')}
          </span>
        )
      },
      width: 180,
    },

    // Currency
    {
      id: 'currency',
      header: 'Currency',
      cell: (merchant) => (
        <span className="text-sm text-muted-foreground">
          {merchant.currency}
        </span>
      ),
      width: 80,
    },

    // Business Scope
    {
      id: 'businessScope',
      header: (
        <DataTableColumnHeader
          title="Business Scope"
          sortDirection={getSortDirection('businessScope', sortBy, sortOrder)}
          onSort={() => onSort('businessScope')}
        />
      ),
      cell: (merchant) => (
        <span className="text-sm text-muted-foreground">
          {BUSINESS_SCOPE_LABELS[merchant.businessScope]}
        </span>
      ),
      width: 130,
    },

    // Days
    {
      id: 'days',
      header: 'Days',
      cell: (merchant) => {
        const days = getDaysCount(merchant.createdAt, merchant.liveAt)
        const isLive = merchant.liveAt !== null
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
      width: 90,
    },

    // Actions
    {
      id: 'actions',
      header: 'Actions',
      cell: (merchant) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <Link
                  to="/merchants/$merchantId"
                  params={{ merchantId: merchant.id }}
                >
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
      ),
      width: 100,
    },
  ]
}
