import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { TruncatedTooltip } from '#/components/truncated-tooltip'
import { DataTableColumnHeader } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import { cn } from '#/lib/utils'
import { getCaseSlaStatus } from '#/lib/sla'
import {
  CLICKABLE_BADGE_CLASSES,
  caseStatusBadgeClasses,
  priorityBadgeClasses,
  slaBadgeClasses,
} from '#/lib/status-styles'
import type { CaseListItem, CaseSortableColumn } from '#/schemas/cases.schema'
import { CASE_STATUS_LABELS } from '#/schemas/cases.schema'
import type { RoleType } from '#/types/auth'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusBadgeClasses(item: CaseListItem): string {
  return caseStatusBadgeClasses(item.status, item.closeOutcome)
}

function getStatusLabel(item: CaseListItem) {
  if (item.status === 'closed' && item.closeOutcome === 'unsuccessful') {
    return 'Unsuccessful'
  }

  return CASE_STATUS_LABELS[item.status]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return format(date, 'MMM dd, yyyy h:mm a')
}

function isCaseClosed(item: CaseListItem) {
  return (
    item.status === 'closed' ||
    item.status === 'error' ||
    !!item.closeOutcome ||
    !!item.closedAt
  )
}

function OwnerCell({
  item,
  canEdit,
  onOpenAssignOwner,
}: {
  item: CaseListItem
  canEdit: boolean
  onOpenAssignOwner: (item: CaseListItem) => void
}) {
  const ownerName = item.ownerName ?? 'AP System'

  if (!canEdit) {
    return <span className="text-sm font-medium text-foreground">{ownerName}</span>
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto cursor-pointer justify-start px-0 text-sm font-medium text-foreground no-underline hover:bg-transparent hover:text-foreground hover:underline hover:decoration-dashed hover:underline-offset-4"
      onClick={() => onOpenAssignOwner(item)}
    >
      {ownerName}
    </Button>
  )
}

function PriorityCell({
  item,
  canEdit,
  onOpenPriority,
}: {
  item: CaseListItem
  canEdit: boolean
  onOpenPriority: (item: CaseListItem) => void
}) {
  const className = cn(
    priorityBadgeClasses(item.priority),
    canEdit && CLICKABLE_BADGE_CLASSES,
  )

  if (!canEdit) {
    return (
      <Badge variant="secondary" className={className}>
        {item.priority === 'high' ? 'High' : 'Normal'}
      </Badge>
    )
  }

  return (
    <Badge
      render={<button type="button" onClick={() => onOpenPriority(item)} />}
      variant="secondary"
      className={className}
    >
      {item.priority === 'high' ? 'High' : 'Normal'}
    </Badge>
  )
}

function SlaCell({ item }: { item: CaseListItem }) {
  const sla = getCaseSlaStatus({
    createdAt: item.createdAt,
    closedAt: item.closedAt,
    status: item.status,
    slaHours: item.queueSlaHours,
    slaBreached: item.slaBreached,
  })

  return (
    <Badge variant="secondary" className={slaBadgeClasses(sla.isBreached)}>
      {sla.isBreached ? 'Breached' : 'On Time'}
    </Badge>
  )
}

// ─── Column Factory ─────────────────────────────────────────────────────────

interface CreateColumnsOptions {
  userRole: RoleType
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort: (columnId: CaseSortableColumn) => void
  selectedIds: Set<string>
  allIds: string[]
  onSelectRow: (id: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onOpenAssignOwner: (item: CaseListItem) => void
  onOpenPriority: (item: CaseListItem) => void
}

function getSortDirection(
  columnId: string,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
): 'asc' | 'desc' | false {
  if (sortBy !== columnId) return false
  return sortOrder ?? false
}

export function createCaseColumns({
  userRole,
  sortBy,
  sortOrder,
  onSort,
  selectedIds,
  allIds,
  onSelectRow,
  onSelectAll,
  onOpenAssignOwner,
  onOpenPriority,
}: CreateColumnsOptions): DataTableColumnDef<CaseListItem>[] {
  const assignableIdSet = new Set(allIds)
  const isAllSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const isSomeSelected =
    !isAllSelected && allIds.some((id) => selectedIds.has(id))
  const canEdit = userRole === 'super_admin' || userRole === 'admin'

  return [
    // Select
    {
      id: 'select',
      header: (
        <Checkbox
          checked={isAllSelected}
          indeterminate={isSomeSelected}
          onCheckedChange={(value) => onSelectAll(!!value)}
          disabled={!canEdit || allIds.length === 0}
          aria-label="Select all"
        />
      ),
      cell: (item) => (
        <Checkbox
          checked={selectedIds.has(item.id)}
          onCheckedChange={(value) => onSelectRow(item.id, !!value)}
          disabled={!canEdit || !assignableIdSet.has(item.id)}
          aria-label="Select row"
        />
      ),
      width: 40,
    },

    // Case Number
    {
      id: 'caseNumber',
      header: (
        <DataTableColumnHeader
          title="Case Number"
          sortDirection={getSortDirection('caseNumber', sortBy, sortOrder)}
          onSort={() => onSort('caseNumber')}
        />
      ),
      cell: (item) => (
        <Link
          to="/cases/$caseId"
          params={{ caseId: item.id }}
          className="font-mono text-sm font-medium tabular-nums text-foreground no-underline hover:underline hover:decoration-dashed hover:underline-offset-4"
        >
          {item.caseNumber}
        </Link>
      ),
      width: 160,
    },

    // Merchant Name
    {
      id: 'merchantName',
      header: (
        <DataTableColumnHeader
          title="Merchant Name"
          sortDirection={getSortDirection('merchantName', sortBy, sortOrder)}
          onSort={() => onSort('merchantName')}
        />
      ),
      cell: (item) => (
        <TruncatedTooltip
          render={<div className="flex max-w-50 flex-col gap-0.5" />}
          content={
            <>
              {item.merchantName}
              {item.subMerchantName ? ` · ${item.subMerchantName}` : null}
            </>
          }
        >
          <Link
            to="/merchants/$merchantId/overview"
            params={{ merchantId: item.merchantId }}
            className="block truncate font-medium text-foreground hover:underline hover:decoration-dashed hover:underline-offset-4"
          >
            {item.merchantName}
          </Link>
          {item.subMerchantName ? (
            <span className="truncate text-xs text-muted-foreground">
              {item.subMerchantName}
            </span>
          ) : null}
        </TruncatedTooltip>
      ),
      width: 200,
    },

    // Case Owner
    {
      id: 'ownerName',
      header: 'Case Owner',
      cell: (item) => (
        <OwnerCell
          item={item}
          canEdit={canEdit && !isCaseClosed(item)}
          onOpenAssignOwner={onOpenAssignOwner}
        />
      ),
      width: 150,
    },

    // Queue
    {
      id: 'queueName',
      header: 'Queue',
      cell: (item) => (
        <div className="flex min-w-0 max-w-full">
          <TruncatedTooltip
            render={<Badge variant="secondary" className="max-w-full" />}
            content={item.queueName}
          >
            <span className="truncate">{item.queueName}</span>
          </TruncatedTooltip>
        </div>
      ),
      width: 130,
    },

    // Case Status
    {
      id: 'status',
      header: (
        <DataTableColumnHeader
          title="Case Status"
          sortDirection={getSortDirection('status', sortBy, sortOrder)}
          onSort={() => onSort('status')}
        />
      ),
      cell: (item) => (
        <Badge variant="secondary" className={getStatusBadgeClasses(item)}>
          {getStatusLabel(item)}
        </Badge>
      ),
      width: 160,
    },

    // SLA
    {
      id: 'sla',
      header: 'SLA',
      cell: (item) => <SlaCell item={item} />,
      width: 110,
    },

    // Priority
    {
      id: 'priority',
      header: 'Priority',
      cell: (item) => (
        <PriorityCell
          item={item}
          canEdit={canEdit && !isCaseClosed(item)}
          onOpenPriority={onOpenPriority}
        />
      ),
      width: 100,
    },

    // Creation Date
    {
      id: 'createdAt',
      header: (
        <DataTableColumnHeader
          title="Creation Date"
          sortDirection={getSortDirection('createdAt', sortBy, sortOrder)}
          onSort={() => onSort('createdAt')}
        />
      ),
      cell: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.createdAt)}
        </span>
      ),
      width: 180,
    },

    // Closed Date
    {
      id: 'closedAt',
      header: (
        <DataTableColumnHeader
          title="Closed Date"
          sortDirection={getSortDirection('closedAt', sortBy, sortOrder)}
          onSort={() => onSort('closedAt')}
        />
      ),
      cell: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.closedAt)}
        </span>
      ),
      width: 180,
    },

    // Last Updated At
    {
      id: 'updatedAt',
      header: (
        <DataTableColumnHeader
          title="Last Updated At"
          sortDirection={getSortDirection('updatedAt', sortBy, sortOrder)}
          onSort={() => onSort('updatedAt')}
        />
      ),
      cell: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.updatedAt)}
        </span>
      ),
      width: 180,
    },
  ]
}
