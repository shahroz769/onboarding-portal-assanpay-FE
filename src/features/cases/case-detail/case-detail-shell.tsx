import { Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  Card,
  CardContent,
  CardHeader,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { caseDetailQueryOptions } from '#/hooks/use-case-detail-query'
import { cn } from '#/lib/utils'
import {
  type CloseOutcome,
  type QueueStage,
} from '#/schemas/cases.schema'

import { CaseSidePanel } from './case-side-panel'
import { getQueueRenderer } from './queue-registry'
import { DocumentsReviewDraftProvider } from './renderers/documents-review-draft-context'

interface CaseDetailShellProps {
  caseId: string
}

export function CaseDetailShell({ caseId }: CaseDetailShellProps) {
  const { data } = useSuspenseQuery(caseDetailQueryOptions(caseId))
  const QueueRenderer = getQueueRenderer(data.queue.slug)
  const merchantName =
    typeof data.merchant.businessName === 'string' &&
    data.merchant.businessName.trim().length > 0
      ? data.merchant.businessName
      : 'Not available'

  const pageContent = (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="gap-4 py-4">
            <CardContent className="grid gap-3 px-4 py-0 md:grid-cols-3">
              <CaseStagesBlock
                stages={data.stages}
                currentStageId={data.currentStage?.id ?? null}
                closeOutcome={data.case.closeOutcome}
              />
              <InfoBlock
                label="Case Number"
                value={data.case.caseNumber}
              />
              <InfoBlock
                label="CASE OWNER"
                value={data.owner?.name ?? 'AP System'}
              />
              <InfoBlock
                label="Merchant Name"
                value={merchantName}
              />
            </CardContent>
          </Card>

          {data.case.closeOutcome === 'unsuccessful' && data.case.closeReason ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Case closed as unsuccessful</AlertTitle>
              <AlertDescription>{data.case.closeReason}</AlertDescription>
            </Alert>
          ) : null}

          <Suspense fallback={<QueueRendererSkeleton />}>
            <QueueRenderer caseDetail={data} caseId={caseId} />
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
          <CaseSidePanel caseDetail={data} caseId={caseId} />
        </div>
      </div>
    </div>
  )

  if (data.queue.slug === 'documents-review') {
    return (
      <DocumentsReviewDraftProvider caseDetail={data}>
        {pageContent}
      </DocumentsReviewDraftProvider>
    )
  }

  return pageContent
}

export function CaseDetailShellSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="gap-4 py-4">
            <CardContent className="grid gap-3 px-4 py-0 md:grid-cols-3">
              <div className="rounded-lg bg-muted p-2 md:col-span-3">
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 w-full rounded-md" />
                  ))}
                </div>
              </div>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-1 rounded-xl border bg-muted/20 px-3 py-2.5"
                >
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
          <div className="flex h-full flex-col gap-3 rounded-xl border bg-muted/10 p-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function CaseStagesBlock({
  stages,
  currentStageId,
  closeOutcome,
}: {
  stages: QueueStage[]
  currentStageId: string | null
  closeOutcome: CloseOutcome | null
}) {
  if (stages.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg bg-muted md:col-span-3">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
      >
        {stages.map((stage) => {
          const isCurrent = stage.id === currentStageId
          const isClosedUnsuccessfully =
            stage.category === 'closed' && closeOutcome === 'unsuccessful'

          return (
            <div
              key={stage.id}
              className={cn(
                'relative inline-flex h-9 items-center justify-center rounded-md text-center text-sm whitespace-nowrap transition-all',
                !isCurrent && 'bg-muted text-muted-foreground/50',
                isCurrent &&
                  stage.slug === 'new' &&
                  'bg-slate-200 text-slate-900 font-semibold dark:bg-slate-800 dark:text-slate-100',
                isCurrent &&
                  stage.slug === 'working' &&
                  'bg-blue-100 text-blue-800 font-semibold dark:bg-blue-900 dark:text-blue-300',
                isCurrent &&
                  stage.slug === 'awaiting_client' &&
                  'bg-amber-100 text-amber-800 font-semibold dark:bg-amber-900 dark:text-amber-300',
                isCurrent &&
                  stage.slug === 'closed' &&
                  !isClosedUnsuccessfully &&
                  'bg-emerald-100 text-emerald-800 font-semibold dark:bg-emerald-900 dark:text-emerald-300',
                isCurrent &&
                  isClosedUnsuccessfully &&
                  'bg-red-100 text-red-800 font-semibold dark:bg-red-900 dark:text-red-300',
              )}
            >
              <span>{stage.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InfoBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-muted/20 px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
        <p className="wrap-break-word text-sm font-semibold">{value}</p>
    </div>
  )
}

function QueueRendererSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  )
}
