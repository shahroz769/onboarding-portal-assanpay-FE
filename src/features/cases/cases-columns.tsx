import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { DataTableColumnHeader } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table/data-table'
import { cn } from '#/lib/utils'
import type { CaseListItem, CaseSortableColumn } from '#/schemas/cases.schema'
import { CASE_STATUS_LABELS } from '#/schemas/cases.schema'
import type { RoleType } from '#/types/auth'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'working':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
    case 'pending':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    case 'qc':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case 'closed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return format(date, 'MMM dd, yyyy h:mm a')
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
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto justify-start px-0 text-sm"
      onClick={canEdit ? () => onOpenAssignOwner(item) : undefined}
      disabled={!canEdit}
    >
      {item.ownerName ?? 'AP System'}
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
    item.priority === 'high' && 'bg-amber-100 text-amber-800',
    canEdit && 'cursor-pointer transition-colors',
  )

  if (!canEdit) {
    return (
      <Badge variant="secondary" className={className}>
        {item.priority === 'high' ? 'High' : 'Normal'}
      </Badge>
    )
  }

  return (
    <Badge asChild variant="secondary" className={className}>
      <button type="button" onClick={() => onOpenPriority(item)}>
        {item.priority === 'high' ? 'High' : 'Normal'}
      </button>
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
  const isAllSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const isSomeSelected =
    !isAllSelected && allIds.some((id) => selectedIds.has(id))
  const canEdit = userRole === 'admin' || userRole === 'supervisor'

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
      cell: (item) => (
        <Checkbox
          checked={selectedIds.has(item.id)}
          onCheckedChange={(value) => onSelectRow(item.id, !!value)}
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
          className="font-mono text-sm font-medium tabular-nums text-primary no-underline hover:underline hover:decoration-dashed hover:underline-offset-4"
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
        <span className="max-w-50 truncate font-medium">
          {item.merchantName}
        </span>
      ),
      width: 200,
    },

    // Queue
    {
      id: 'queueName',
      header: 'Queue',
      cell: (item) => <Badge variant="secondary">{item.queueName}</Badge>,
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
        <Badge className={getStatusBadgeClasses(item.status)}>
          {CASE_STATUS_LABELS[item.status]}
        </Badge>
      ),
      width: 120,
    },

    // Priority
    {
      id: 'priority',
      header: 'Priority',
      cell: (item) => (
        <PriorityCell
          item={item}
          canEdit={canEdit}
          onOpenPriority={onOpenPriority}
        />
      ),
      width: 100,
    },

    // Case Owner
    {
      id: 'ownerName',
      header: 'Case Owner',
      cell: (item) => (
        <OwnerCell
          item={item}
          canEdit={canEdit}
          onOpenAssignOwner={onOpenAssignOwner}
        />
      ),
      width: 150,
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
