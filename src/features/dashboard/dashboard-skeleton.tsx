import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
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

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <KpiSectionSkeleton titleWidth="w-12" />
        <KpiSectionSkeleton titleWidth="w-20" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
    </div>
  )
}
