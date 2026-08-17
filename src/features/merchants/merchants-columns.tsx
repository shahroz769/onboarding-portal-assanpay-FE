import { format } from 'date-fns'
import { BanIcon, EyeIcon, Trash2Icon } from 'lucide-react'
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
import type {
  MerchantListItem,
  MerchantSortableColumn,
} from '#/schemas/merchants.schema'
import {
  MERCHANT_STATUS_DISPLAY,
  PRIORITY_LABELS,
  BUSINESS_SCOPE_LABELS,
} from '#/schemas/merchants.schema'
import {
  CLICKABLE_BADGE_CLASSES,
  merchantStatusBadgeClasses,
  priorityBadgeClasses,
} from '#/lib/status-styles'
import { cn } from '#/lib/utils'
import type { RoleType } from '#/types/auth'

// ─── Column Factory ─────────────────────────────────────────────────────────

interface CreateColumnsOptions {
  userRole: RoleType
  sortBy?: MerchantSortableColumn
  sortOrder?: 'asc' | 'desc'
  onSort: (columnId: MerchantSortableColumn) => void
  selectedIds: Set<string>
  allIds: string[]
  onSelectRow: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onPriorityClick: (merchant: MerchantListItem) => void
  onTerminateClick: (merchant: MerchantListItem) => void
  onDeleteClick: (merchant: MerchantListItem) => void
}

function getSortDirection(
  columnId: MerchantSortableColumn,
  sortBy?: MerchantSortableColumn,
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
  onTerminateClick,
  onDeleteClick,
}: CreateColumnsOptions): DataTableColumnDef<MerchantListItem>[] {
  const canEdit = userRole === 'super_admin' || userRole === 'admin'
  const canTerminate = userRole === 'super_admin'

  const isAllSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const isSomeSelected =
    !isAllSelected && allIds.some((id) => selectedIds.has(id))

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
      width: 240,
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
        const display = MERCHANT_STATUS_DISPLAY[merchant.status]
        return (
          <Badge className={merchantStatusBadgeClasses(merchant.status)}>
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
            className={
              cn(
                priorityBadgeClasses(merchant.priority),
                canEdit && CLICKABLE_BADGE_CLASSES,
              ) || undefined
            }
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
          {canTerminate && merchant.status !== 'terminated' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onTerminateClick(merchant)}
                >
                  <BanIcon className="size-4" />
                  <span className="sr-only">Terminate</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Terminate</TooltipContent>
            </Tooltip>
          )}
          {canTerminate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDeleteClick(merchant)}
                >
                  <Trash2Icon />
                  <span className="sr-only">Delete permanently</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete permanently</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ),
      width: 140,
    },
  ]
}
