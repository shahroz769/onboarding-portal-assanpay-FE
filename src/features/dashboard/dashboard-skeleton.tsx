import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { cn } from '#/lib/utils'

function KpiSectionSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <section className="flex flex-col gap-3">
      <Skeleton className={cn('h-4', titleWidth)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="gap-0 py-4">
            <CardHeader className="px-4">
              <Skeleton className="h-3.5 w-24 max-w-full" />
            </CardHeader>
            <CardContent className="px-4">
              <Skeleton className="h-8 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ChartCardSkeleton({
  className,
  titleWidth,
  descriptionWidth,
  chartClassName,
}: {
  className?: string
  titleWidth: string
  descriptionWidth: string
  chartClassName: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className={cn('h-5', titleWidth)} />
        <Skeleton className={cn('h-4 max-w-full', descriptionWidth)} />
      </CardHeader>
      <CardContent>
        <Skeleton
          className={cn('aspect-auto w-full rounded-md', chartClassName)}
        />
      </CardContent>
    </Card>
  )
}

function QueueTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Skeleton className="h-4 w-12" />
              </TableHead>
              {Array.from({ length: 6 }).map((_, index) => (
                <TableHead key={index} className="text-right">
                  <Skeleton className="ml-auto h-4 w-14" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 9 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell>
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="mt-1 h-3 w-16" />
                </TableCell>
                {Array.from({ length: 6 }).map((_, cellIndex) => (
                  <TableCell key={cellIndex} className="text-right">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function PortalMidsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-12 w-full rounded-md" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </CardContent>
    </Card>
  )
}

function AttentionRequiredSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-52 max-w-full" />
      </CardHeader>
      <CardContent>
        <div className="grid w-full grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 rounded-md" />
          ))}
        </div>
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>
                <Skeleton className="h-4 w-10" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-14" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead className="text-right">
                <Skeleton className="ml-auto h-4 w-8" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell>
                  <Skeleton className="h-4 w-24 max-w-full" />
                  <Skeleton className="mt-1 h-3 w-32 max-w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20 max-w-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RecentListCardSkeleton({
  titleWidth,
  descriptionWidth,
  rowCount,
}: {
  titleWidth: string
  descriptionWidth: string
  rowCount: number
}) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={cn('h-5', titleWidth)} />
        <Skeleton className={cn('h-4 max-w-full', descriptionWidth)} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell>
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="mt-1 h-3 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <KpiSectionSkeleton titleWidth="w-12" />
        <KpiSectionSkeleton titleWidth="w-20" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCardSkeleton
          className="lg:col-span-2"
          titleWidth="w-32"
          descriptionWidth="w-72"
          chartClassName="h-72"
        />
        <ChartCardSkeleton
          titleWidth="w-36"
          descriptionWidth="w-56"
          chartClassName="h-64"
        />
        <ChartCardSkeleton
          titleWidth="w-40"
          descriptionWidth="w-64"
          chartClassName="h-64"
        />
      </div>

      <PortalMidsSkeleton />

      <QueueTableSkeleton />

      <div className="grid gap-4 xl:grid-cols-2">
        <AttentionRequiredSkeleton />
        <div className="flex flex-col gap-4">
          <RecentListCardSkeleton
            titleWidth="w-40"
            descriptionWidth="w-48"
            rowCount={5}
          />
          <RecentListCardSkeleton
            titleWidth="w-36"
            descriptionWidth="w-44"
            rowCount={5}
          />
        </div>
      </div>
    </div>
  )
}
