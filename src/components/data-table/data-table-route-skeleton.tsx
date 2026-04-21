import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export function DataTableRouteSkeleton({
  filterCount = 3,
  searchWidth = 384,
  filterWidths,
  actionWidth = 144,
  columnWidths,
  rowCount = 10,
}: {
  filterCount?: number
  searchWidth?: number
  filterWidths?: number[]
  actionWidth?: number
  columnWidths?: number[]
  rowCount?: number
}) {
  const resolvedFilterWidths =
    filterWidths ?? Array.from({ length: filterCount }, () => 112)
  const resolvedColumnWidths =
    columnWidths ?? Array.from({ length: 10 }, () => 140)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Skeleton
            className="h-9 max-w-full"
            style={{ width: searchWidth }}
          />
          {resolvedFilterWidths.map((width, index) => (
            <Skeleton
              key={index}
              className="h-9"
              style={{ width }}
            />
          ))}
        </div>
        <Skeleton className="h-5" style={{ width: actionWidth }} />
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table className="table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
            <TableRow>
              {resolvedColumnWidths.map((width, index) => (
                <TableHead
                  key={index}
                  style={{ width }}
                >
                  <Skeleton
                    className="h-4"
                    style={{ width: Math.max(Math.min(width - 24, width), 16) }}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {resolvedColumnWidths.map((width, cellIndex) => (
                  <TableCell key={cellIndex} className="h-12 py-0">
                    <Skeleton
                      className="h-4"
                      style={{
                        width:
                          cellIndex === 0
                            ? 16
                            : Math.max(Math.round(width * 0.65), 24),
                      }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}