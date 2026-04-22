import { Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock3,
  MailCheck,
  MessageSquareMore,
  Send,
  ShieldAlert,
  UserRoundPlus,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '#/components/ui/alert'
import {
  Card,
  CardContent,
} from '#/components/ui/card'
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { useAuth } from '#/features/auth/auth-client'
import {
  caseHistoryQueryOptions,
  useAdvanceStage,
  useCloseUnsuccessful,
  useTakeOwnership,
} from '#/hooks/use-case-detail-query'
import type { CaseDetail } from '#/schemas/cases.schema'

import { CaseChatter } from './case-chatter'
import { CaseHistoryTimeline } from './case-history-timeline'
import { DocumentsReviewSummaryModal } from './documents-review-summary-modal'
import { RejectionRoundsCard } from './rejection-rounds-card'
import { getDocumentsReviewSummary } from './renderers/documents-review-shared'
import { useOptionalDocumentsReviewDraft } from './renderers/documents-review-draft-context'

interface CaseSidePanelProps {
  caseDetail: CaseDetail
  caseId: string
}

function getPrimaryActionCopy(
  caseDetail: CaseDetail,
  options: {
    isDocumentReviewCase: boolean
    isReviewApproved: boolean
    hasActiveRejections: boolean
    hasResubmittedUpdates: boolean
  },
) {
  const status = caseDetail.case.status
  const category = caseDetail.currentStage?.category ?? null
  const hasOwner = Boolean(caseDetail.owner)
  const isClosed =
    status === 'error' ||
    status === 'closed' ||
    category === 'error' ||
    category === 'closed' ||
    Boolean(caseDetail.case.closedAt) ||
    Boolean(caseDetail.case.closeOutcome)

  if (!isClosed && !hasOwner) {
    return {
      title: 'Ownership required',
      description:
        'Claim this case to move it from new into active review and unlock the resolution workflow.',
      actionLabel: 'Take ownership',
      actionKind: 'take-ownership' as const,
    }
  }

  if (status === 'awaiting_client') {
    return {
      title: 'Awaiting client',
      description:
        'A resubmission email was sent to the client. The case will return to working once they submit the requested updates.',
      actionLabel: null,
      actionKind: 'awaiting-client' as const,
    }
  }

  if (
    options.isDocumentReviewCase &&
    status === 'working' &&
    !options.isReviewApproved &&
    !options.hasActiveRejections &&
    options.hasResubmittedUpdates
  ) {
    return {
      title: 'Updated items ready',
      description:
        'The client resubmitted the requested updates and there are no active rejections. You can now close this case successfully if everything looks good.',
      actionLabel: 'Mark as successful',
      actionKind: 'mark-successful' as const,
    }
  }

  if (options.isDocumentReviewCase && status === 'working' && !options.isReviewApproved) {
    return {
      title: 'Review required',
      description:
        'Open the review summary, confirm the rejected fields, and email the client to request a resubmission.',
      actionLabel: 'Review',
      actionKind: 'review' as const,
    }
  }

  if (options.isDocumentReviewCase && status === 'working' && options.isReviewApproved) {
    return {
      title: 'Review approved',
      description:
        'The document-review approval is saved. You can now mark this case as successful.',
      actionLabel: 'Mark as successful',
      actionKind: 'mark-successful' as const,
    }
  }

  if (status === 'working') {
    return {
      title: 'Working stage',
      description:
        'Finish the active review work for this case, then move it into pending for the next checkpoint.',
      actionLabel: 'Move to pending',
      actionKind: 'mark-successful' as const,
    }
  }

  if (status === 'pending') {
    return {
      title: 'Pending decision',
      description: caseDetail.queue.qcEnabled
        ? 'This case is waiting for its next checkpoint. Send it to QC when the review is ready.'
        : 'This case is ready for a final successful closure.',
      actionLabel: caseDetail.queue.qcEnabled ? 'Send to QC' : 'Mark as successful',
      actionKind: 'mark-successful' as const,
    }
  }

  if (status === 'qc') {
    return {
      title: 'QC review',
      description:
        'Quality control is the final checkpoint. Close the case successfully when QC is complete, or use the resolution tab to close it unsuccessfully.',
      actionLabel: 'Mark as successful',
      actionKind: 'mark-successful' as const,
    }
  }

  if (isClosed) {
    return {
      title: 'Case resolved',
      description:
        caseDetail.case.closeOutcome === 'successful'
          ? 'This case has already been closed successfully.'
          : 'This case has already been closed as unsuccessful.',
      actionLabel: null,
      actionKind: null,
    }
  }

  return {
    title: 'Case workspace',
    description:
      'Use the tabs below to collaborate on the case, review its history, and complete the final decision.',
    actionLabel: null,
    actionKind: null,
  }
}

export function CaseSidePanel({
  caseDetail,
  caseId,
}: CaseSidePanelProps) {
  const { user } = useAuth()
  const takeOwnership = useTakeOwnership(caseId)
  const advanceStage = useAdvanceStage(caseId)
  const closeUnsuccessful = useCloseUnsuccessful(caseId)

  const [closeReason, setCloseReason] = useState('')
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const documentsReviewDraft = useOptionalDocumentsReviewDraft()

  const isDocumentReviewCase = caseDetail.queue.slug === 'documents-review'
  const reviewSummary = isDocumentReviewCase
    ? (documentsReviewDraft?.reviewSummary ?? getDocumentsReviewSummary(caseDetail))
    : null
  const isReviewApproved = reviewSummary?.isFullyApproved ?? false
  const hasActiveRejections = (reviewSummary?.rejectedItems.length ?? 0) > 0
  const hasResubmittedUpdates = caseDetail.fieldReviews.some(
    (review) => Boolean(review.resubmittedAt),
  )

  const primaryAction = getPrimaryActionCopy(caseDetail, {
    isDocumentReviewCase,
    isReviewApproved,
    hasActiveRejections,
    hasResubmittedUpdates,
  })
  const status = caseDetail.case.status
  const category = caseDetail.currentStage?.category ?? null
  const hasOwner = Boolean(caseDetail.owner)
  const isCaseOwner = Boolean(caseDetail.owner && user?.id === caseDetail.owner.id)
  const isClosed = category === 'closed' || category === 'error'
  const isNew = category === 'new'
  const isInProgress = category === 'in_progress'

  const canCloseUnsuccessfully = !isClosed && isCaseOwner
  const unsuccessfulDisabled =
    !closeReason.trim() || closeUnsuccessful.isPending

  function handlePrimaryAction() {
    if (primaryAction.actionKind === 'take-ownership') {
      takeOwnership.mutate()
      return
    }

    if (primaryAction.actionKind === 'review') {
      setReviewModalOpen(true)
      return
    }

    if (primaryAction.actionKind === 'mark-successful') {
      advanceStage.mutate()
    }
  }

  function handleCloseUnsuccessful() {
    if (unsuccessfulDisabled) return

    closeUnsuccessful.mutate({
      reason: closeReason.trim(),
    })
  }

  return (
    <Card className="min-h-128 gap-4 py-4 xl:h-[calc(100dvh-7rem)] xl:min-h-0">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-0">
        <Tabs
          defaultValue="resolution"
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resolution">
              <ShieldAlert />
              Resolution
            </TabsTrigger>
            <TabsTrigger value="chatter">
              <MessageSquareMore />
              Chatter
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock3 />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resolution" className="min-h-0">
            <div className="flex h-full flex-col gap-3">
              {isClosed ? (
                <Alert
                  variant={
                    caseDetail.case.closeOutcome === 'successful'
                      ? 'default'
                      : 'destructive'
                  }
                >
                  {caseDetail.case.closeOutcome === 'successful' ? (
                    <CheckCircle2 />
                  ) : (
                    <ShieldAlert />
                  )}
                  <AlertTitle>
                    {caseDetail.case.closeOutcome === 'successful'
                      ? 'Closed successfully'
                      : 'Closed unsuccessfully'}
                  </AlertTitle>
                  {caseDetail.case.closeReason ? (
                    <AlertDescription>
                      {caseDetail.case.closeReason}
                    </AlertDescription>
                  ) : null}
                </Alert>
              ) : null}

              {!isClosed ? (
                <div className="rounded-xl border bg-background p-3">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      {primaryAction.actionKind === 'take-ownership'
                        ? 'Take ownership first to move the case into active review.'
                        : primaryAction.actionKind === 'review'
                          ? isCaseOwner
                            ? 'Review the rejected fields and email the client to request a resubmission.'
                            : 'Only the current case owner can review rejected fields and request a resubmission.'
                          : primaryAction.actionKind === 'awaiting-client'
                            ? 'Waiting for the client to update the requested fields.'
                            : isCaseOwner
                              ? 'When everything checks out, close this case successfully.'
                              : 'Only the current case owner can complete this case.'}
                    </p>
                    {primaryAction.actionKind === 'awaiting-client' ? null : (
                      <Button
                        onClick={handlePrimaryAction}
                        disabled={
                          (primaryAction.actionKind !== 'take-ownership' &&
                            primaryAction.actionKind !== 'mark-successful' &&
                            primaryAction.actionKind !== 'review') ||
                          (primaryAction.actionKind === 'review' &&
                            (
                              !hasActiveRejections ||
                              !isCaseOwner
                            )) ||
                          (primaryAction.actionKind === 'mark-successful' &&
                            hasOwner &&
                            !isCaseOwner)
                        }
                      >
                        {primaryAction.actionKind === 'take-ownership' ? (
                          takeOwnership.isPending ? (
                            <Spinner data-icon="inline-start" />
                          ) : (
                            <UserRoundPlus data-icon="inline-start" />
                          )
                        ) : primaryAction.actionKind === 'review' ? (
                          <Send data-icon="inline-start" />
                        ) : advanceStage.isPending ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <CheckCircle2 data-icon="inline-start" />
                        )}
                        {primaryAction.actionKind === 'take-ownership'
                          ? takeOwnership.isPending
                            ? 'Taking ownership'
                            : 'Take ownership'
                          : primaryAction.actionKind === 'review'
                            ? 'Review'
                            : primaryAction.actionKind === 'mark-successful'
                              ? advanceStage.isPending
                                ? 'Closing case'
                                : 'Mark as successful'
                              : 'No successful action available'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}

              {isDocumentReviewCase &&
              hasOwner &&
              status === 'awaiting_client' ? (
                <AwaitingClientAlert caseId={caseId} />
              ) : null}

              {isDocumentReviewCase &&
              hasOwner &&
              category === 'in_progress' &&
              isReviewApproved ? (
                <Alert>
                  <CheckCircle2 />
                  <AlertTitle>Review approved</AlertTitle>
                  <AlertDescription>
                    All document-review items are approved in the database. You can now mark this case as successful.
                  </AlertDescription>
                </Alert>
              ) : null}

              {canCloseUnsuccessfully ? (
                <div className="rounded-xl border bg-background p-3">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="close-reason">
                        Reason
                      </FieldLabel>
                      <Textarea
                        value={closeReason}
                        id="close-reason"
                        onChange={(event) => setCloseReason(event.target.value)}
                        placeholder="Write closing reason"
                        className="min-h-28 resize-none"
                      />
                    </Field>
                  </FieldGroup>

                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="destructive"
                      onClick={handleCloseUnsuccessful}
                      disabled={unsuccessfulDisabled}
                    >
                      {closeUnsuccessful.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <ShieldAlert data-icon="inline-start" />
                      )}
                      {closeUnsuccessful.isPending
                        ? 'Closing unsuccessfully'
                        : 'Close as unsuccessful'}
                    </Button>
                  </div>
                </div>
              ) : null}

              {!isClosed && hasOwner && !isInProgress && !isNew ? (
                <div className="rounded-xl border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
                  This case is not in a stage that can be resolved from the side
                  panel yet.
                </div>
              ) : null}

              {isDocumentReviewCase ? (
                <RejectionRoundsCard caseId={caseId} />
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="chatter" className="min-h-0">
            <Suspense fallback={<SidePanelSkeleton />}>
              <CaseChatter caseId={caseId} embedded />
            </Suspense>
          </TabsContent>

          <TabsContent value="history" className="min-h-0">
            <Suspense fallback={<SidePanelSkeleton />}>
              <CaseHistoryTimeline caseId={caseId} embedded />
            </Suspense>
          </TabsContent>

        </Tabs>
      </CardContent>

      {isDocumentReviewCase ? (
        <DocumentsReviewSummaryModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          caseDetail={caseDetail}
          caseId={caseId}
          reviewSummary={reviewSummary}
        />
      ) : null}
    </Card>
  )
}

function AwaitingClientAlert({ caseId }: { caseId: string }) {
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))

  const expiresAt = useMemo(() => {
    const items = historyQuery.data
    if (!items) return null
    const latest = items.find(
      (h) => h.action === 'resubmission_email_sent',
    )
    const details = latest?.details as
      | { expiresAt?: string | null }
      | null
      | undefined
    return details?.expiresAt ?? null
  }, [historyQuery.data])

  const expiresLabel = useMemo(() => {
    if (!expiresAt) return null
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(expiresAt))
    } catch {
      return null
    }
  }, [expiresAt])

  return (
    <Alert>
      <MailCheck />
      <AlertTitle>Awaiting client resubmission</AlertTitle>
      <AlertDescription>
        We emailed the client a secure link to update the rejected fields. The
        case will return to working as soon as they submit.
        {expiresLabel ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            Link expires {expiresLabel}
          </span>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

function SidePanelSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border bg-muted/10 p-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
