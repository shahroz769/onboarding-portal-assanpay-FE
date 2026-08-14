import { createElement, Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import { caseDetailQueryOptions } from '#/hooks/use-case-detail-query'
import { cn } from '#/lib/utils'
import { getCaseSlaStatus } from '#/lib/sla'
import type {
  CaseDetail,
  CloseOutcome,
  QueueStage,
} from '#/schemas/cases.schema'

import { CaseSidePanel } from './case-side-panel'
import { CaseQueueWorkspaceSkeleton } from './case-detail-skeletons'
import { getQueueRenderer, resolveQueueWorkflowType } from './queue-registry'
import { DocumentsReviewDraftProvider } from './renderers/documents-review-draft-context'

interface CaseDetailShellProps {
  caseId: string
}

export function CaseDetailShell({ caseId }: CaseDetailShellProps) {
  const { data } = useSuspenseQuery(caseDetailQueryOptions(caseId))
  const workflowType = resolveQueueWorkflowType(data.queue)
  const queueRenderer = getQueueRenderer(workflowType)
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
              <InfoBlock label="Case Number" value={data.case.caseNumber} />
              <InfoBlock
                label="CASE OWNER"
                value={data.owner?.name ?? 'AP System'}
              />
              <InfoBlock label="Merchant Name" value={merchantName} />
            </CardContent>
          </Card>

          {data.case.closeOutcome === 'unsuccessful' &&
          data.case.closeReason ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Case closed as unsuccessful</AlertTitle>
              <AlertDescription>{data.case.closeReason}</AlertDescription>
            </Alert>
          ) : null}

          <CaseSlaBox caseDetail={data} />

          <Suspense fallback={<CaseQueueWorkspaceSkeleton />}>
            {createElement(queueRenderer, { caseDetail: data, caseId })}
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
          <CaseSidePanel caseDetail={data} caseId={caseId} />
        </div>
      </div>
    </div>
  )

  if (workflowType === 'document_review') {
    return (
      <DocumentsReviewDraftProvider caseDetail={data}>
        {pageContent}
      </DocumentsReviewDraftProvider>
    )
  }

  return pageContent
}

export { CaseDetailShellSkeleton } from './case-detail-skeletons'

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

  const currentStageIndex = stages.findIndex(
    (stage) => stage.id === currentStageId,
  )

  return (
    <div className="overflow-hidden rounded-md bg-muted md:col-span-3">
      <div
        className="relative grid gap-0 overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
        }}
      >
        {stages.map((stage, index) => {
          const isCurrent = stage.id === currentStageId
          const isPassed = currentStageIndex >= 0 && index < currentStageIndex
          const connectsToCompletedFlow = isPassed && index < currentStageIndex
          const isClosedUnsuccessfully =
            stage.category === 'closed' && closeOutcome === 'unsuccessful'
          const showCompletedIcon =
            isPassed ||
            (isCurrent && stage.slug === 'closed' && !isClosedUnsuccessfully)

          return (
            <div key={stage.id} className="min-w-0">
              <div
                data-stage-state={
                  isCurrent ? 'current' : isPassed ? 'passed' : 'upcoming'
                }
                className={cn(
                  'motion-case-stage relative inline-flex h-9 w-full items-center justify-center gap-1.5 text-center text-sm whitespace-nowrap',
                  !isCurrent &&
                    !isPassed &&
                    'bg-muted text-muted-foreground/50',
                  isPassed &&
                    stage.slug !== 'closed' &&
                    'bg-emerald-100 text-emerald-800 font-semibold dark:bg-emerald-900 dark:text-emerald-300',
                  isPassed &&
                    stage.slug === 'closed' &&
                    'bg-blue-100 text-blue-800 font-semibold dark:bg-blue-900 dark:text-blue-300',
                  connectsToCompletedFlow && 'rounded-r-none',
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
                    stage.slug.includes('pending') &&
                    'bg-amber-100 text-amber-800 font-semibold dark:bg-amber-900 dark:text-amber-300',
                  isCurrent &&
                    stage.slug === 'docs_upload' &&
                    'bg-blue-100 text-blue-800 font-semibold dark:bg-blue-900 dark:text-blue-300',
                  isCurrent &&
                    stage.slug === 'closed' &&
                    !isClosedUnsuccessfully &&
                    'bg-blue-100 text-blue-800 font-semibold dark:bg-blue-900 dark:text-blue-300',
                  isCurrent &&
                    isClosedUnsuccessfully &&
                    'bg-red-100 text-red-800 font-semibold dark:bg-red-900 dark:text-red-300',
                  'rounded-none',
                )}
              >
                {showCompletedIcon ? (
                  <span className="motion-case-stage-icon flex shrink-0">
                    <CheckCircle2 className="size-4" />
                  </span>
                ) : null}
                <span>{stage.name}</span>
              </div>
            </div>
          )
        })}
        <div
          aria-hidden="true"
          className="motion-case-stage-indicator pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-foreground/50"
          style={{
            width: `${100 / stages.length}%`,
            opacity: currentStageIndex >= 0 ? 1 : 0,
            transform: `translateX(${Math.max(currentStageIndex, 0) * 100}%)`,
          }}
        />
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-muted/20 px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <p className="wrap-break-word text-sm font-semibold">{value}</p>
    </div>
  )
}

const SLA_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function CaseSlaBox({ caseDetail }: { caseDetail: CaseDetail }) {
  const sla = getCaseSlaStatus({
    createdAt: caseDetail.case.createdAt,
    closedAt: caseDetail.case.closedAt,
    status: caseDetail.case.status,
    slaHours: caseDetail.queue.slaHours,
    slaBreached: caseDetail.case.slaBreached,
  })

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4 py-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">SLA</span>
          </div>
          {sla.isBreached ? (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
              Breached
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
              On Time
            </Badge>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoBlock
            label="SLA Target"
            value={`${sla.slaHours} ${sla.slaHours === 1 ? 'hour' : 'hours'}`}
          />
          <InfoBlock
            label="Created At"
            value={SLA_DATE_FORMAT.format(new Date(caseDetail.case.createdAt))}
          />
          <InfoBlock
            label="SLA Deadline"
            value={SLA_DATE_FORMAT.format(sla.deadline)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
