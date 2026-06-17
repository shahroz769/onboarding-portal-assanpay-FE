import {
  Card,
  CardContent,
  CardHeader,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

const STAGE_COUNT = 4
const WORKSPACE_FIELD_COUNT = 3

function InfoBlockSkeleton() {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-muted/20 px-3 py-2.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-32 max-w-full" />
    </div>
  )
}

function CaseHeaderCardSkeleton() {
  return (
    <Card className="gap-4 py-4">
      <CardContent className="grid gap-3 px-4 py-0 md:grid-cols-3">
        <div className="overflow-hidden rounded-md bg-muted md:col-span-3">
          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: `repeat(${STAGE_COUNT}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: STAGE_COUNT }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-none" />
            ))}
          </div>
        </div>
        <InfoBlockSkeleton />
        <InfoBlockSkeleton />
        <InfoBlockSkeleton />
      </CardContent>
    </Card>
  )
}

function CaseSlaCardSkeleton() {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4 py-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-8" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoBlockSkeleton />
          <InfoBlockSkeleton />
          <InfoBlockSkeleton />
        </div>
      </CardContent>
    </Card>
  )
}

export function CaseQueueWorkspaceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: WORKSPACE_FIELD_COUNT }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function CaseSidePanelSkeleton() {
  return (
    <Card className="min-h-128 w-full min-w-0 max-w-full gap-4 overflow-hidden py-4 xl:h-[calc(100dvh-7rem)] xl:min-h-0">
      <CardContent className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 px-4 py-0">
        <div className="grid h-9 w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          <Skeleton className="h-7 rounded-md" />
          <Skeleton className="h-7 rounded-md" />
          <Skeleton className="h-7 rounded-md" />
        </div>

        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="rounded-xl border bg-background p-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-1 h-9 w-40 rounded-md" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CaseDetailShellSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <CaseHeaderCardSkeleton />
          <CaseSlaCardSkeleton />
          <CaseQueueWorkspaceSkeleton />
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
          <CaseSidePanelSkeleton />
        </div>
      </div>
    </div>
  )
}
