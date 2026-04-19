import { Suspense, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  MessageSquareMore,
  ShieldAlert,
  UserRoundPlus,
} from 'lucide-react'

import { Badge } from '#/components/ui/badge'
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import {
  useAdvanceStage,
  useCloseUnsuccessful,
  useSaveFieldReviews,
  useTakeOwnership,
} from '#/hooks/use-case-detail-query'
import {
  type CaseDetail,
} from '#/schemas/cases.schema'

import { CaseChatter } from './case-chatter'
import { CaseHistoryTimeline } from './case-history-timeline'
import {
  createApproveAllReviewsInput,
  getDocumentsReviewSummary,
} from './renderers/documents-review-shared'
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

  if (options.isDocumentReviewCase && status === 'working' && !options.isReviewApproved) {
    return {
      title: 'Review required',
      description:
        'Open the review summary, confirm the document-review results, and approve them before marking this case as successful.',
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
  const takeOwnership = useTakeOwnership(caseId)
  const advanceStage = useAdvanceStage(caseId)
  const saveFieldReviews = useSaveFieldReviews(caseId)
  const closeUnsuccessful = useCloseUnsuccessful(caseId)

  const [closeReason, setCloseReason] = useState('')
  const [showReviewSummary, setShowReviewSummary] = useState(false)
  const documentsReviewDraft = useOptionalDocumentsReviewDraft()

  const isDocumentReviewCase = caseDetail.queue.slug === 'documents-review'
  const reviewSummary = isDocumentReviewCase
    ? (documentsReviewDraft?.reviewSummary ?? getDocumentsReviewSummary(caseDetail))
    : null
  const isReviewApproved = reviewSummary?.isFullyApproved ?? false

  const primaryAction = getPrimaryActionCopy(caseDetail, {
    isDocumentReviewCase,
    isReviewApproved,
  })
  const category = caseDetail.currentStage?.category ?? null
  const hasOwner = Boolean(caseDetail.owner)
  const isClosed = category === 'closed' || category === 'error'
  const isNew = category === 'new'
  const isInProgress = category === 'in_progress'

  const canCloseUnsuccessfully = !isClosed && hasOwner
  const unsuccessfulDisabled =
    !closeReason.trim() || closeUnsuccessful.isPending

  function handlePrimaryAction() {
    if (primaryAction.actionKind === 'take-ownership') {
      takeOwnership.mutate()
      return
    }

    if (primaryAction.actionKind === 'review') {
      setShowReviewSummary(true)
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

  function handleApproveReview() {
    if (!isDocumentReviewCase || !reviewSummary || reviewSummary.reviewables.length === 0) {
      return
    }

    saveFieldReviews.mutate(createApproveAllReviewsInput(caseDetail), {
      onSuccess: () => {
        setShowReviewSummary(false)
      },
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
                          ? 'Review the saved rejections summary and approve the document review before moving forward.'
                          : 'When everything checks out, close this case successfully.'}
                    </p>
                    <Button
                      onClick={handlePrimaryAction}
                      disabled={
                        primaryAction.actionKind !== 'take-ownership' &&
                        primaryAction.actionKind !== 'mark-successful' &&
                        primaryAction.actionKind !== 'review'
                      }
                    >
                      {primaryAction.actionKind === 'take-ownership' ? (
                        takeOwnership.isPending ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <UserRoundPlus data-icon="inline-start" />
                        )
                      ) : primaryAction.actionKind === 'review' ? (
                        <Clock3 data-icon="inline-start" />
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
                  </div>
                </div>
              ) : null}

              {isDocumentReviewCase &&
              hasOwner &&
              category === 'in_progress' &&
              showReviewSummary &&
              !isReviewApproved &&
              reviewSummary ? (
                <div className="rounded-xl border bg-background p-3">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold">Review summary</p>
                        <p className="text-sm text-muted-foreground">
                          Confirm the current rejections and save an approved review set to continue.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {reviewSummary.approvedItems.length} approved
                        </Badge>
                        <Badge variant="secondary">
                          {reviewSummary.rejectedItems.length} rejected
                        </Badge>
                        <Badge variant="secondary">
                          {reviewSummary.pendingItems.length} pending
                        </Badge>
                      </div>
                    </div>

                    {reviewSummary.rejectedItems.length > 0 ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                        <p className="text-sm font-medium text-destructive">
                          Rejection summary
                        </p>
                        <div className="flex flex-col gap-2">
                          {reviewSummary.rejectedItems.map((item) => (
                            <div
                              key={item.key}
                              className="rounded-lg border border-destructive/10 bg-background px-3 py-2"
                            >
                              <p className="text-sm font-medium">{item.label}</p>
                              {item.remarks ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {item.remarks}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <CheckCircle2 />
                        <AlertTitle>No saved rejections</AlertTitle>
                        <AlertDescription>
                          Everything currently reviewed is ready to be approved and saved.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex justify-end">
                      <Button
                        onClick={handleApproveReview}
                        disabled={
                          saveFieldReviews.isPending ||
                          reviewSummary.reviewables.length === 0
                        }
                      >
                        {saveFieldReviews.isPending ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <CheckCircle2 data-icon="inline-start" />
                        )}
                        {saveFieldReviews.isPending
                          ? 'Saving approval'
                          : 'Approve and save'}
                      </Button>
                    </div>
                  </div>
                </div>
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
    </Card>
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
