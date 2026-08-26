import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Field, FieldGroup } from '#/components/ui/field'
import { Skeleton } from '#/components/ui/skeleton'

function SectionHeaderSkeleton({
  titleWidth = 'w-44',
  descriptionWidth = 'w-96',
  action,
}: {
  titleWidth?: string
  descriptionWidth?: string
  action?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className={`h-5 ${titleWidth}`} />
          <Skeleton className={`h-4 max-w-full ${descriptionWidth}`} />
        </div>
      </div>
      {action ? <Skeleton className="h-8 w-32 rounded-md" /> : null}
    </div>
  )
}

function ActionBarSkeleton() {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t bg-background/90 py-4">
      <Skeleton className="h-9 w-40 rounded-md" />
    </div>
  )
}

function FieldSkeleton() {
  return (
    <Field>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-full" />
    </Field>
  )
}

function TablePanelSkeleton({
  columns,
  action,
}: {
  columns: number
  action?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <SectionHeaderSkeleton action={action} />
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border">
          <div
            className="grid gap-4 border-b px-3 py-3"
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
      </CardContent>
    </Card>
  )
}

export function LimitsAndMdrSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <LimitRangeCardSkeleton />
        <LimitRangeCardSkeleton />
      </div>
      <Card>
        <CardHeader>
          <SectionHeaderSkeleton titleWidth="w-56" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <FieldSkeleton key={index} />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <SectionHeaderSkeleton titleWidth="w-52" />
        </CardHeader>
        <CardContent>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <MethodPricingGroupSkeleton />
            <MethodPricingGroupSkeleton />
          </div>
        </CardContent>
      </Card>
      <ActionBarSkeleton />
    </div>
  )
}

function LimitRangeCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <SectionHeaderSkeleton titleWidth="w-36" descriptionWidth="w-64" />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-56" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
        </div>
        <div className="border-t" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-48" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
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
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <SectionHeaderSkeleton action />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto]"
              >
                <Skeleton className="h-4 w-4" />
                <div className="grid gap-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <Skeleton className="size-9 rounded-md" />
                <div className="grid gap-3 sm:col-start-2 sm:col-end-4 sm:grid-cols-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <ActionBarSkeleton />
    </div>
  )
}

export function AgreementsSkeleton() {
  return <TablePanelSkeleton columns={4} />
}

export function SubMerchantsSkeleton() {
  return <TablePanelSkeleton columns={4} action />
}

export function QueuesSkeleton() {
  return <TablePanelSkeleton columns={5} action />
}

export function MerchantPortalSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <SectionHeaderSkeleton titleWidth="w-64" />
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-32" />
              <FieldSkeleton />
            </div>
            <div className="h-px w-full bg-border" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <div className="grid gap-4 md:grid-cols-2">
                <FieldSkeleton />
                <FieldSkeleton />
              </div>
            </div>
            <div className="h-px w-full bg-border" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-32" />
              <Field>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-20 w-full" />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldSkeleton />
                <FieldSkeleton />
              </div>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
      <ActionBarSkeleton />
    </div>
  )
}

export function LinkDeadlinesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <SectionHeaderSkeleton titleWidth="w-36" />
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <FieldSkeleton key={index} />
              ))}
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
      <ActionBarSkeleton />
    </div>
  )
}

export function EmailSendingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <SectionHeaderSkeleton titleWidth="w-32" />
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Skeleton className="mt-0.5 size-4 rounded-sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Skeleton className="mt-0.5 size-4 rounded-sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            </div>
            <ActionBarSkeleton />
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}

export function CaseTriggeringSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <SectionHeaderSkeleton titleWidth="w-40" />
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
      <ActionBarSkeleton />
    </div>
  )
}

export function WorkflowBuilderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="relative h-[62vh] min-h-[480px] min-w-0 flex-1 overflow-hidden rounded-lg border bg-muted/20">
          <Skeleton className="absolute top-6 left-6 h-[76px] w-[208px] rounded-lg" />
          <Skeleton className="absolute top-24 left-[38%] h-[76px] w-[236px] rounded-lg" />
          <Skeleton className="absolute top-48 left-[38%] h-[76px] w-[236px] rounded-lg" />
          <Skeleton className="absolute top-36 right-[8%] h-[76px] w-[236px] rounded-lg" />
        </div>
        <Card className="shrink-0 xl:w-[320px]">
          <CardHeader>
            <SectionHeaderSkeleton titleWidth="w-36" descriptionWidth="w-52" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      </div>
      <ActionBarSkeleton />
    </div>
  )
}
