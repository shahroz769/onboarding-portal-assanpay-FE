import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

const stickyHeaderClassName =
  'sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]'

type SkeletonCellKind =
  | 'checkbox'
  | 'mono'
  | 'link'
  | 'text'
  | 'badge'
  | 'date'
  | 'actions'

interface SkeletonColumn {
  width: number
  kind?: SkeletonCellKind
  headerWidth?: number
  cellWidth?: number
}

export function DataTableRouteSkeleton({
  filterCount = 3,
  searchWidth = 384,
  filterWidths,
  actionWidth = 144,
  columns,
  columnWidths,
  rowCount = 10,
}: {
  filterCount?: number
  searchWidth?: number
  filterWidths?: number[]
  actionWidth?: number
  columns?: SkeletonColumn[]
  columnWidths?: number[]
  rowCount?: number
}) {
  const resolvedFilterWidths =
    filterWidths ?? Array.from({ length: filterCount }, () => 112)
  const resolvedColumns =
    columns ??
    (columnWidths ?? Array.from({ length: 10 }, () => 140)).map((width) => ({
      width,
      kind: 'text' as const,
    }))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="shrink-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div
              className="flex h-9 max-w-sm items-center gap-2 rounded-md border bg-background px-3"
              style={{ width: searchWidth }}
            >
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 min-w-0 flex-1" />
            </div>
            {resolvedFilterWidths.map((width, index) => (
              <Skeleton
                key={index}
                className="h-8 rounded-md"
                style={{ width }}
              />
            ))}
          </div>
          <Skeleton className="h-5" style={{ width: actionWidth }} />
        </div>
      </div>

      <div className="shrink-0" />

      <div className="min-h-0 flex-1">
        <div className="view-transition-none h-full overflow-auto rounded-md border will-change-transform">
          <Table className="table-fixed">
            <TableHeader className={stickyHeaderClassName}>
              <TableRow>
                {resolvedColumns.map((column, index) => (
                  <TableHead key={index} style={{ width: column.width }}>
                    <HeaderSkeleton column={column} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rowCount }).map((_, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="h-12 content-visibility-auto contain-intrinsic-size-auto-48px"
                >
                  {resolvedColumns.map((column, cellIndex) => (
                    <TableCell key={cellIndex} className="h-12 py-0">
                      <CellSkeleton column={column} rowIndex={rowIndex} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function HeaderSkeleton({ column }: { column: SkeletonColumn }) {
  if (column.kind === 'checkbox') {
    return <Skeleton className="size-4 rounded-[4px]" />
  }

  const width =
    column.headerWidth ??
    Math.max(Math.min(column.width - 24, column.width), 16)

  return <Skeleton className="h-4" style={{ width }} />
}

function CellSkeleton({
  column,
  rowIndex,
}: {
  column: SkeletonColumn
  rowIndex: number
}) {
  switch (column.kind) {
    case 'checkbox':
      return <Skeleton className="size-4 rounded-[4px]" />
    case 'badge':
      return (
        <Skeleton
          className="h-5 rounded-md"
          style={{ width: column.cellWidth ?? Math.min(column.width - 24, 96) }}
        />
      )
    case 'actions':
      return (
        <div className="flex items-center gap-1">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      )
    case 'date':
      return (
        <Skeleton
          className="h-4"
          style={{
            width: column.cellWidth ?? Math.min(column.width - 24, 136),
          }}
        />
      )
    case 'mono':
    case 'link':
      return (
        <Skeleton
          className="h-4"
          style={{
            width: column.cellWidth ?? Math.min(column.width - 24, 112),
          }}
        />
      )
    case 'text':
    default: {
      const widthOffset = rowIndex % 3 === 0 ? 32 : rowIndex % 3 === 1 ? 48 : 24
      return (
        <Skeleton
          className="h-4"
          style={{
            width:
              column.cellWidth ??
              Math.max(Math.min(column.width - widthOffset, column.width), 36),
          }}
        />
      )
    }
  }
}
