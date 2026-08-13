import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

type SkeletonCellKind =
  'checkbox' | 'mono' | 'link' | 'text' | 'badge' | 'date' | 'actions'

interface SkeletonColumn {
  width: number
  grow?: boolean
  kind?: SkeletonCellKind
  header?: React.ReactNode
  cellWidth?: number
}

export function DataTableRouteSkeleton({
  actionWidth = 144,
  columns,
  columnWidths,
  filterCount,
  filterWidths,
  rowCount = 10,
  searchWidth,
}: {
  filterCount?: number
  searchWidth?: number
  filterWidths?: number[]
  actionWidth?: number
  columns?: SkeletonColumn[]
  columnWidths?: number[]
  rowCount?: number
}) {
  void filterCount
  void searchWidth
  void filterWidths

  const resolvedColumns: SkeletonColumn[] =
    columns ??
    (columnWidths ?? Array.from({ length: 10 }, () => 140)).map((width) => ({
      width,
      kind: 'text' as const,
    }))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="shrink-0">
        <div className="flex justify-end">
          <Skeleton className="h-5" style={{ width: actionWidth }} />
        </div>
      </div>

      <div className="shrink-0" />

      <div className="min-h-0 flex-1">
        <div className="view-transition-none h-full overflow-auto rounded-md border bg-background">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow>
                {resolvedColumns.map((column, columnIndex) => (
                  <TableHead
                    key={columnIndex}
                    style={column.grow ? undefined : { width: column.width }}
                  >
                    {column.header}
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

function CellSkeleton({
  column,
  rowIndex,
}: {
  column: SkeletonColumn
  rowIndex: number
}) {
  switch (column.kind) {
    case 'checkbox':
      return <Skeleton className="size-4 rounded-lg" />
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
