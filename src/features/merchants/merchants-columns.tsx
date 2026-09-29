import { format } from 'date-fns'
import { BanIcon, ChevronDownIcon, EyeIcon, Trash2Icon } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Button, ButtonLink } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { TruncatedTooltip } from '#/components/truncated-tooltip'
import { DataTableColumnHeader } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import type {
  MerchantListItem,
  MerchantSortableColumn,
} from '#/schemas/merchants.schema'
import {
  MERCHANT_STATUS_DISPLAY,
  PRIORITY_LABELS,
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
  onPriorityClick: (merchant: MerchantListItem, trigger: HTMLElement) => void
  onTerminateClick: (merchant: MerchantListItem, trigger: HTMLElement) => void
  onDeleteClick: (merchant: MerchantListItem, trigger: HTMLElement) => void
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
  const canTerminate = userRole === 'super_admin' || userRole === 'admin'
  const canDelete = userRole === 'super_admin'

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
          checked={isAllSelected}
          indeterminate={isSomeSelected}
          onCheckedChange={(value) => onSelectAll(!!value)}
          aria-label="Select all merchants"
        />
      ),
      cell: (merchant) => (
        <Checkbox
          checked={selectedIds.has(merchant.id)}
          onCheckedChange={(value) => onSelectRow(merchant.id, !!value)}
          aria-label={`Select ${merchant.businessName}`}
        />
      ),
      width: 40,
    },

    // Merchant Name
    {
      id: 'businessName',
      sortDirection: getSortDirection('businessName', sortBy, sortOrder),
      header: (
        <DataTableColumnHeader
          title="Merchant Name"
          sortDirection={getSortDirection('businessName', sortBy, sortOrder)}
          onSort={() => onSort('businessName')}
        />
      ),
      cell: (merchant) => (
        <TruncatedTooltip
          render={
            <Link
              to="/merchants/$merchantId/overview"
              params={{ merchantId: merchant.id }}
              className="block max-w-80 truncate font-medium text-foreground hover:underline hover:decoration-dashed hover:underline-offset-4"
            />
          }
          content={merchant.businessName}
        >
          {merchant.businessName}
        </TruncatedTooltip>
      ),
      width: 300,
    },

    // Owner Full Name
    {
      id: 'ownerFullName',
      sortDirection: getSortDirection('ownerFullName', sortBy, sortOrder),
      header: (
        <DataTableColumnHeader
          title="Owner"
          sortDirection={getSortDirection('ownerFullName', sortBy, sortOrder)}
          onSort={() => onSort('ownerFullName')}
        />
      ),
      cell: (merchant) => (
        <TruncatedTooltip
          render={<span className="block max-w-52 truncate text-sm" />}
          content={merchant.ownerFullName}
          focusable
        >
          {merchant.ownerFullName}
        </TruncatedTooltip>
      ),
      width: 220,
    },

    // Status (derived)
    {
      id: 'status',
      sortDirection: getSortDirection('status', sortBy, sortOrder),
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
      sortDirection: getSortDirection('priority', sortBy, sortOrder),
      header: (
        <DataTableColumnHeader
          title="Priority"
          sortDirection={getSortDirection('priority', sortBy, sortOrder)}
          onSort={() => onSort('priority')}
        />
      ),
      cell: (merchant) => {
        const canEditMerchantPriority =
          canEdit && merchant.status !== 'terminated'
        const label = PRIORITY_LABELS[merchant.priority]
        const priorityBadge = (
          <Badge
            // A button when editable, so it is reachable by keyboard; a
            // read-only badge with a note still takes focus to show it.
            render={
              canEditMerchantPriority ? (
                <button
                  type="button"
                  aria-label={`${label} priority, change`}
                  onClick={(event) =>
                    onPriorityClick(merchant, event.currentTarget)
                  }
                />
              ) : merchant.priorityNote ? (
                <span tabIndex={0} />
              ) : undefined
            }
            variant="secondary"
            className={
              cn(
                priorityBadgeClasses(merchant.priority),
                canEditMerchantPriority && CLICKABLE_BADGE_CLASSES,
              ) || undefined
            }
          >
            {label}
            {canEditMerchantPriority ? (
              <ChevronDownIcon aria-hidden="true" />
            ) : null}
          </Badge>
        )

        if (merchant.priorityNote) {
          return (
            <Tooltip>
              <TooltipTrigger render={priorityBadge} />
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

    // Open Cases
    {
      id: 'openCasesCount',
      header: 'Open Cases',
      cell: (merchant) =>
        merchant.openCasesCount > 0 ? (
          <span className="text-sm font-medium tabular-nums">
            {merchant.openCasesCount}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      width: 110,
    },

    // Created At
    {
      id: 'createdAt',
      sortDirection: getSortDirection('createdAt', sortBy, sortOrder),
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

    // Went Live
    {
      id: 'liveAt',
      header: 'Went Live',
      cell: (merchant) =>
        merchant.liveAt ? (
          <span className="text-sm text-muted-foreground">
            {format(new Date(merchant.liveAt), 'MMM dd, yyyy')}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      width: 130,
    },

    // Last Updated
    {
      id: 'updatedAt',
      sortDirection: getSortDirection('updatedAt', sortBy, sortOrder),
      header: (
        <DataTableColumnHeader
          title="Last Updated"
          sortDirection={getSortDirection('updatedAt', sortBy, sortOrder)}
          onSort={() => onSort('updatedAt')}
        />
      ),
      cell: (merchant) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(merchant.updatedAt), 'MMM dd, yyyy h:mm a')}
        </span>
      ),
      width: 180,
    },

    // Actions
    {
      id: 'actions',
      header: 'Actions',
      cell: (merchant) => (
        <div className="flex items-center gap-1">
          <ButtonLink
            variant="ghost"
            size="icon"
            className="size-8"
            render={
              <Link
                to="/merchants/$merchantId/overview"
                params={{ merchantId: merchant.id }}
              />
            }
          >
            <EyeIcon className="size-4" />
            <span className="sr-only">View {merchant.businessName}</span>
          </ButtonLink>
          {canTerminate && merchant.status !== 'terminated' && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(event) =>
                      onTerminateClick(merchant, event.currentTarget)
                    }
                  />
                }
              >
                <BanIcon className="size-4" />
                <span className="sr-only">
                  Terminate {merchant.businessName}
                </span>
              </TooltipTrigger>
              <TooltipContent>Terminate</TooltipContent>
            </Tooltip>
          )}
          {canDelete && merchant.status === 'terminated' ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(event) =>
                      onDeleteClick(merchant, event.currentTarget)
                    }
                  />
                }
              >
                <Trash2Icon />
                <span className="sr-only">
                  Delete {merchant.businessName} permanently
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Delete terminated merchant permanently
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ),
      width: 140,
    },
  ]
}
