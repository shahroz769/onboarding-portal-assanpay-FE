import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Field } from '#/components/ui/field'
import { Skeleton } from '#/components/ui/skeleton'

function FieldSkeleton() {
  return (
    <Field>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-full" />
    </Field>
  )
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div
        className="grid gap-4 border-b bg-muted px-3 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-24" />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid h-12 items-center gap-4 border-b px-3 last:border-b-0"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
          }}
        >
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full max-w-40" />
          ))}
        </div>
      ))}
    </div>
  )
}

function SettingsPanelSkeleton({ sections }: { sections: number[] }) {
  return (
    <div className="divide-y rounded-xl border bg-card">
      {sections.map((fieldCount, index) => (
        <div
          key={index}
          className="grid gap-4 p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-10"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full max-w-52" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: fieldCount }).map((_, fieldIndex) => (
              <FieldSkeleton key={fieldIndex} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function LimitsAndMdrSkeleton() {
  return (
    <Card>
      <CardContent>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <MethodPricingGroupSkeleton />
          <MethodPricingGroupSkeleton />
        </div>
      </CardContent>
    </Card>
  )
}

function MethodPricingGroupSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="rounded-md border bg-muted/20 p-3">
          <Skeleton className="h-4 w-36" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MethodListSkeleton() {
  return <TableSkeleton columns={5} />
}

export function AgreementsSkeleton() {
  return <TableSkeleton columns={4} />
}

export function SubMerchantsSkeleton() {
  return <TableSkeleton columns={4} />
}

export function QueuesSkeleton() {
  return <TableSkeleton columns={5} />
}

export function MerchantPortalSkeleton() {
  return <SettingsPanelSkeleton sections={[1, 2, 4]} />
}

export function LinkDeadlinesSkeleton() {
  return <SettingsPanelSkeleton sections={[1, 1, 1]} />
}

export function EmailSendingSkeleton() {
  return <SettingsPanelSkeleton sections={[2]} />
}

export function CaseTriggeringSkeleton() {
  return <SettingsPanelSkeleton sections={[2]} />
}

export function WorkflowBuilderSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="flex flex-col gap-4 xl:min-h-0 xl:flex-1 xl:flex-row">
        <div className="relative h-[60vh] min-h-105 min-w-0 overflow-hidden rounded-lg border bg-muted/20 xl:h-auto xl:min-h-0 xl:flex-1">
          <Skeleton className="absolute top-6 left-6 h-19 w-52 rounded-lg" />
          <Skeleton className="absolute top-24 left-[38%] h-19 w-59 rounded-lg" />
          <Skeleton className="absolute top-48 left-[38%] h-19 w-59 rounded-lg" />
          <Skeleton className="absolute top-36 right-[8%] h-19 w-59 rounded-lg" />
        </div>
        <Card className="shrink-0 xl:w-85">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
