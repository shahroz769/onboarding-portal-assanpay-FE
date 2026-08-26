import { Activity, Suspense, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Card, CardContent } from '#/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { useAuth } from '#/features/auth/auth-client'
import {
  caseHistoryQueryOptions,
  useAdvanceStage,
  useCloseUnsuccessful,
  useSaveDocumentReviewSubMerchant,
  useTakeOwnership,
} from '#/hooks/use-case-detail-query'
import type { CaseDetail } from '#/schemas/cases.schema'
import { formatExpiryLabel, NO_EXPIRY_LABEL } from '#/lib/expiry'

import { AgreementRoundsCard } from './agreement-rounds-card'
import { CaseChatter } from './case-chatter'
import { CaseHistoryTimeline } from './case-history-timeline'
import { DocumentsReviewSummaryModal } from './documents-review-summary-modal'
import { RejectionRoundsCard } from './rejection-rounds-card'
import { resolveQueueWorkflowType } from './queue-registry'
import { getDocumentsReviewSummary } from './renderers/documents-review-shared'
import { useOptionalDocumentsReviewDraft } from './renderers/documents-review-draft-context'

const TESTING_CREDENTIALS_SENT_ACTIONS = new Set([
  'mid_creation_email_sent',
  'mid_creation_email_sent_manual',
  'mid_creation_whatsapp_sent_manual',
])

interface CaseSidePanelProps {
  caseDetail: CaseDetail
  caseId: string
}

type SidePanelTab = 'resolution' | 'chatter' | 'history'

function KeepAliveTabBody({
  visited,
  active,
  fallback,
  children,
}: {
  visited: boolean
  active: boolean
  fallback: ReactNode
  children: ReactNode
}) {
  if (!visited) return null

  return (
    <Activity mode={active ? 'visible' : 'hidden'}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </Activity>
  )
}

function getPrimaryActionCopy(
  caseDetail: CaseDetail,
  options: {
    isDocumentReviewCase: boolean
    isReviewApproved: boolean
    hasActiveRejections: boolean
    isSubMerchantFormCase: boolean
    hasSubMerchantFinalForm: boolean
    isMidCreationCase: boolean
    hasMidCreationCredentials: boolean
    isTestingCase: boolean
    hasTestingCredentialsSent: boolean
    isTestingHistoryPending: boolean
    isAgreementCase: boolean
    hasAgreementFinal: boolean
    hasReceivedAgreement: boolean
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

  if (options.isAgreementCase && status === 'awaiting_client') {
    return {
      title: 'Awaiting signed agreement',
      description:
        'The agreement and delivery instructions were sent. Upload the scanned signed copy when it arrives at the office.',
      actionLabel: null,
      actionKind: 'agreement' as const,
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
    options.isAgreementCase &&
    status === 'working' &&
    options.hasReceivedAgreement
  ) {
    return {
      title: 'Signed agreement received',
      description:
        'The scanned signed agreement is saved. You can now close this case successfully.',
      actionLabel: 'Mark as successful',
      actionKind: 'mark-successful' as const,
    }
  }

  if (options.isAgreementCase && status === 'working') {
    return {
      title: options.hasAgreementFinal
        ? 'Final Agreement ready'
        : 'Final Agreement required',
      description: options.hasAgreementFinal
        ? 'Open the Agreement workspace, review the final agreement, then send mail to the client.'
        : 'Upload the Final Agreement in the Agreement workspace before sending mail.',
      actionLabel: null,
      actionKind: 'agreement' as const,
    }
  }

  if (options.isSubMerchantFormCase && status === 'working') {
    if (options.hasSubMerchantFinalForm) {
      return {
        title: 'Final Form ready',
        description:
          'Use the manual Gmail details in the case workspace, upload the sent-email screenshot, then save to close this case successfully.',
        actionLabel: null,
        actionKind: 'sub-merchant-form' as const,
      }
    }

    return {
      title: 'Final Form required',
      description:
        'Open the inherited sub-merchant draft and upload the Final Form before review can begin.',
      actionLabel: null,
      actionKind: 'sub-merchant-form' as const,
    }
  }

  if (options.isMidCreationCase && status === 'working') {
    if (options.hasMidCreationCredentials) {
      return {
        title: 'Merchant IDs saved',
        description:
          'Both merchant IDs are saved. You can now close this case successfully.',
        actionLabel: 'Mark as successful',
        actionKind: 'mark-successful' as const,
      }
    }

    return {
      title: 'Merchant IDs required',
      description:
        'Save the email, MID, and Branch Code for both merchant IDs before closing this case successfully.',
      actionLabel: null,
      actionKind: 'mid-creation' as const,
    }
  }

  if (options.isTestingCase && status === 'working') {
    if (options.isTestingHistoryPending) {
      return {
        title: 'Checking credentials send',
        description:
          'Checking whether credentials were sent by auto Resend, manual Gmail, or WhatsApp before closure.',
        actionLabel: null,
        actionKind: 'testing' as const,
      }
    }

    if (!options.hasTestingCredentialsSent) {
      return {
        title: 'Credentials send required',
        description:
          'Send merchant portal credentials by auto Resend, manual Gmail, or WhatsApp in the Testing workspace before closing this case successfully.',
        actionLabel: null,
        actionKind: 'testing' as const,
      }
    }

    return {
      title: 'Testing complete',
      description:
        'Merchant portal credentials were sent. You can now close this case successfully.',
      actionLabel: 'Mark as successful',
      actionKind: 'mark-successful' as const,
    }
  }

  if (
    options.isDocumentReviewCase &&
    status === 'working' &&
    !options.hasActiveRejections
  ) {
    return {
      title: options.isReviewApproved
        ? 'Review approved'
        : 'No document issues',
      description: options.isReviewApproved
        ? 'The document-review approval is saved. You can now mark this case as successful.'
        : 'There are no rejected fields or documents. You can close this case successfully.',
      actionLabel: 'Mark as successful',
      actionKind: 'mark-successful' as const,
    }
  }

  if (
    options.isDocumentReviewCase &&
    status === 'working' &&
    !options.isReviewApproved
  ) {
    return {
      title: 'Review required',
      description:
        'Open the review summary, confirm the rejected fields, and email the client to request a resubmission.',
      actionLabel: 'Review',
      actionKind: 'review' as const,
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
      actionLabel: caseDetail.queue.qcEnabled
        ? 'Send to QC'
        : 'Mark as successful',
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

export function CaseSidePanel({ caseDetail, caseId }: CaseSidePanelProps) {
  const { user } = useAuth()
  const takeOwnership = useTakeOwnership(caseId)
  const advanceStage = useAdvanceStage(caseId)
  const closeUnsuccessful = useCloseUnsuccessful(caseId)
  const saveSubMerchant = useSaveDocumentReviewSubMerchant(caseId)

  const [closeReason, setCloseReason] = useState('')
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('resolution')
  const [visitedChatter, setVisitedChatter] = useState(false)
  const [visitedHistory, setVisitedHistory] = useState(false)
  const [actionInFlight, setActionInFlight] = useState<
    'primary' | 'unsuccessful' | null
  >(null)
  const primaryActionLockedRef = useRef(false)
  const documentsReviewDraft = useOptionalDocumentsReviewDraft()

  const workflowType = resolveQueueWorkflowType(caseDetail.queue)
  const isDocumentReviewCase = workflowType === 'document_review'
  const isSubMerchantFormCase = workflowType === 'sub_merchant_form'
  const isMidCreationCase = workflowType === 'mid'
  const isTestingCase = workflowType === 'testing'
  const isAgreementCase = workflowType === 'agreement'
  const caseHistoryQuery = useQuery({
    ...caseHistoryQueryOptions(caseId),
    enabled: isTestingCase,
  })
  const reviewSummary = isDocumentReviewCase
    ? (documentsReviewDraft?.reviewSummary ??
      getDocumentsReviewSummary(caseDetail))
    : null
  const isReviewApproved = reviewSummary?.isFullyApproved ?? false
  const hasActiveRejections = (reviewSummary?.rejectedItems.length ?? 0) > 0
  const hasTestingCredentialsSent =
    caseHistoryQuery.data?.some((entry) =>
      TESTING_CREDENTIALS_SENT_ACTIONS.has(entry.action),
    ) ?? false

  const primaryAction = getPrimaryActionCopy(caseDetail, {
    isDocumentReviewCase,
    isReviewApproved,
    hasActiveRejections,
    isSubMerchantFormCase,
    hasSubMerchantFinalForm: Boolean(caseDetail.subMerchantForm?.finalForm),
    isMidCreationCase,
    hasMidCreationCredentials: Boolean(caseDetail.testing?.credentialsReady),
    isTestingCase,
    hasTestingCredentialsSent,
    isTestingHistoryPending: isTestingCase && caseHistoryQuery.isPending,
    isAgreementCase,
    hasAgreementFinal: Boolean(caseDetail.agreement?.finalAgreement),
    hasReceivedAgreement: Boolean(caseDetail.agreement?.receivedAgreement),
  })
  const status = caseDetail.case.status
  const category = caseDetail.currentStage?.category ?? null
  const hasOwner = Boolean(caseDetail.owner)
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isClosed = category === 'closed' || category === 'error'
  const isNew = category === 'new'
  const isInProgress = category === 'in_progress'
  const showPrimaryActionButton =
    primaryAction.actionKind !== 'awaiting-client' &&
    primaryAction.actionKind !== 'sub-merchant-form' &&
    primaryAction.actionKind !== 'mid-creation' &&
    primaryAction.actionKind !== 'testing' &&
    primaryAction.actionKind !== 'agreement'

  const canCloseUnsuccessfully = !isClosed && isCaseOwner
  const primaryButtonPending =
    actionInFlight === 'primary' ||
    takeOwnership.isPending ||
    advanceStage.isPending ||
    saveSubMerchant.isPending
  const unsuccessfulButtonPending =
    actionInFlight === 'unsuccessful' || closeUnsuccessful.isPending
  const actionPending = primaryButtonPending || unsuccessfulButtonPending
  const unsuccessfulDisabled = !closeReason.trim() || actionPending

  async function saveChangedSubMerchantBeforeReview() {
    if (
      !documentsReviewDraft?.isSubMerchantChanged ||
      documentsReviewDraft.selectedSubMerchantIds.length === 0
    ) {
      return
    }

    await saveSubMerchant.mutateAsync({
      subMerchantIds: documentsReviewDraft.selectedSubMerchantIds,
    })
  }

  async function handlePrimaryAction() {
    if (actionPending || primaryActionLockedRef.current) return
    primaryActionLockedRef.current = true
    setActionInFlight('primary')

    if (primaryAction.actionKind === 'take-ownership') {
      takeOwnership.mutate(undefined, {
        onSettled: () => {
          primaryActionLockedRef.current = false
          setActionInFlight(null)
        },
      })
      return
    }

    if (primaryAction.actionKind === 'review') {
      await saveChangedSubMerchantBeforeReview()
        .then(() => setReviewModalOpen(true))
        .catch(() => {
          // Mutation hook already surfaces the backend error via toast.
        })
        .finally(() => {
          primaryActionLockedRef.current = false
          setActionInFlight(null)
        })
      return
    }

    if (primaryAction.actionKind === 'mark-successful') {
      const selectedSubMerchant =
        documentsReviewDraft?.selectedSubMerchantIds.length ||
        caseDetail.documentReview?.subMerchants.length

      if (isDocumentReviewCase && !selectedSubMerchant) {
        toast.error(
          'Select at least one sub-merchant before marking this case as successful.',
        )
        primaryActionLockedRef.current = false
        setActionInFlight(null)
        return
      }

      if (isDocumentReviewCase) {
        try {
          await saveChangedSubMerchantBeforeReview()
        } catch {
          primaryActionLockedRef.current = false
          setActionInFlight(null)
          return
        }
      }

      advanceStage.mutate(undefined, {
        onSettled: () => {
          primaryActionLockedRef.current = false
          setActionInFlight(null)
        },
      })
      return
    }

    primaryActionLockedRef.current = false
    setActionInFlight(null)
  }

  async function handleCloseUnsuccessful() {
    if (unsuccessfulDisabled || primaryActionLockedRef.current) return
    primaryActionLockedRef.current = true
    setActionInFlight('unsuccessful')

    await closeUnsuccessful
      .mutateAsync({
        reason: closeReason.trim(),
      })
      .finally(() => {
        primaryActionLockedRef.current = false
        setActionInFlight(null)
      })
  }

  return (
    <Card className="min-h-128 w-full min-w-0 max-w-full gap-4 overflow-hidden py-4 xl:h-[calc(100dvh-7rem)] xl:min-h-0">
      <CardContent className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 px-4 py-0">
        <Tabs
          value={sidePanelTab}
          onValueChange={(value) => {
            if (value === 'chatter') setVisitedChatter(true)
            if (value === 'history') setVisitedHistory(true)
            if (
              value === 'resolution' ||
              value === 'chatter' ||
              value === 'history'
            ) {
              setSidePanelTab(value)
            }
          }}
          className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-hidden"
        >
          <TabsList className="grid w-full min-w-0 grid-cols-3">
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

          <TabsContent
            value="resolution"
            className="min-h-0 w-full min-w-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden"
          >
            <Suspense fallback={<ResolutionTabSkeleton />}>
              <div className="scrollbar-none flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden overflow-y-auto pb-1">
                {isClosed ? (
                  <Alert
                    className="min-w-0"
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
                      <AlertDescription className="min-w-0 break-words">
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
                              : primaryAction.actionKind === 'sub-merchant-form'
                                ? 'Upload the Final Form for the inherited sub-merchant in the case workspace.'
                                : primaryAction.actionKind === 'mid-creation'
                                  ? 'Save the email, MID, and Branch Code for both merchant IDs before closing this case.'
                                  : primaryAction.actionKind === 'testing'
                                    ? 'Complete testing limits and send credentials by auto Resend, manual Gmail, or WhatsApp in the case workspace.'
                                    : primaryAction.actionKind === 'agreement'
                                      ? 'Complete the Agreement email and received-copy workflow in the case workspace.'
                                      : isCaseOwner
                                        ? 'When everything checks out, close this case successfully.'
                                        : 'Only the current case owner can complete this case.'}
                      </p>
                      {showPrimaryActionButton ? (
                        <Button
                          onClick={handlePrimaryAction}
                          disabled={
                            actionPending ||
                            (primaryAction.actionKind !== 'take-ownership' &&
                              primaryAction.actionKind !== 'mark-successful' &&
                              primaryAction.actionKind !== 'review') ||
                            (primaryAction.actionKind === 'review' &&
                              (!hasActiveRejections || !isCaseOwner)) ||
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
                            primaryButtonPending ? (
                              <Spinner data-icon="inline-start" />
                            ) : (
                              <Send data-icon="inline-start" />
                            )
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
                              ? primaryButtonPending
                                ? 'Opening review'
                                : 'Review'
                              : primaryAction.actionKind === 'mark-successful'
                                ? primaryButtonPending
                                  ? 'Closing case'
                                  : 'Mark as successful'
                                : 'No successful action available'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {isDocumentReviewCase &&
                hasOwner &&
                status === 'awaiting_client' ? (
                  <AwaitingClientAlert
                    caseId={caseId}
                    action="resubmission_email_sent"
                    title="Awaiting client resubmission"
                    description="We emailed the client a secure link to update the rejected fields. The case will return to working as soon as they submit."
                  />
                ) : null}

                {isAgreementCase && hasOwner && status === 'awaiting_client' ? (
                  <AwaitingClientAlert
                    caseId={caseId}
                    action="agreement_email_sent"
                    title="Awaiting client agreement"
                    description="We emailed the client a secure link to upload the signed agreement. The case will return to working as soon as they submit."
                  />
                ) : null}

                {isDocumentReviewCase &&
                hasOwner &&
                category === 'in_progress' &&
                isReviewApproved ? (
                  <Alert variant="success">
                    <CheckCircle2 />
                    <AlertTitle>Review approved</AlertTitle>
                    <AlertDescription>
                      All document-review items are approved in the database.
                      You can now mark this case as successful.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {canCloseUnsuccessfully ? (
                  <div className="rounded-xl border bg-background p-3">
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="close-reason">Reason</FieldLabel>
                        <Textarea
                          value={closeReason}
                          id="close-reason"
                          onChange={(event) =>
                            setCloseReason(event.target.value)
                          }
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
                        {unsuccessfulButtonPending ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <ShieldAlert data-icon="inline-start" />
                        )}
                        {unsuccessfulButtonPending
                          ? 'Closing unsuccessfully'
                          : 'Close as unsuccessful'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!isClosed && hasOwner && !isInProgress && !isNew ? (
                  <div className="rounded-xl border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
                    This case is not in a stage that can be resolved from the
                    side panel yet.
                  </div>
                ) : null}

                {isDocumentReviewCase ? (
                  <RejectionRoundsCard caseId={caseId} />
                ) : null}

                {isAgreementCase ? (
                  <AgreementRoundsCard caseId={caseId} />
                ) : null}
              </div>
            </Suspense>
          </TabsContent>

          <TabsContent
            value="chatter"
            forceMount={visitedChatter ? true : undefined}
            className="min-h-0 w-full min-w-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden"
          >
            <KeepAliveTabBody
              visited={visitedChatter}
              active={sidePanelTab === 'chatter'}
              fallback={<ChatterTabSkeleton />}
            >
              <CaseChatter caseId={caseId} canPost embedded />
            </KeepAliveTabBody>
          </TabsContent>

          <TabsContent
            value="history"
            forceMount={visitedHistory ? true : undefined}
            className="min-h-0 w-full min-w-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden"
          >
            <KeepAliveTabBody
              visited={visitedHistory}
              active={sidePanelTab === 'history'}
              fallback={<HistoryTabSkeleton />}
            >
              <CaseHistoryTimeline caseId={caseId} embedded />
            </KeepAliveTabBody>
          </TabsContent>
        </Tabs>
      </CardContent>

      {isDocumentReviewCase && reviewModalOpen ? (
        <DocumentsReviewSummaryModal
          onOpenChange={setReviewModalOpen}
          caseDetail={caseDetail}
          caseId={caseId}
          reviewSummary={reviewSummary}
        />
      ) : null}
    </Card>
  )
}

function AwaitingClientAlert({
  caseId,
  action,
  title,
  description,
}: {
  caseId: string
  action: string
  title: string
  description: string
}) {
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))

  const expiresAt = (() => {
    const items = historyQuery.data
    if (!items) return null
    const latest = items.find((h) => h.action === action)
    const details = latest?.details as
      { expiresAt?: string | null } | null | undefined
    return details?.expiresAt ?? null
  })()

  const expiresLabel = formatExpiryLabel(expiresAt, (date) =>
    EXPIRY_DATE_TIME_FORMATTER.format(date),
  )

  return (
    <Alert>
      <MailCheck />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {description}
        {expiresLabel ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            {expiresLabel === NO_EXPIRY_LABEL
              ? expiresLabel
              : `Link expires ${expiresLabel}`}
          </span>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

function ResolutionTabSkeleton() {
  return (
    <div className="scrollbar-none flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      <div className="grid min-w-0 grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3 rounded-lg border bg-card px-4 py-3">
        <Skeleton className="mt-0.5 size-4 rounded-full" />
        <Skeleton className="h-4 w-36 max-w-full" />
      </div>

      <div className="min-w-0 rounded-xl border bg-background p-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-1 h-9 w-36 rounded-md" />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card py-4 shadow-sm">
        <div className="flex min-w-0 items-start gap-3 px-4">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        </div>

        <div className="flex min-w-0 flex-col gap-3 px-4">
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
            <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-4 w-16" />
            </div>
            <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-4 w-8" />
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border bg-background">
            <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className="mt-2 h-3 w-32 max-w-full" />
                </div>
              </div>
              <Skeleton className="size-4 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatterTabSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden">
      <div className="min-w-0 rounded-2xl border border-border/70 bg-background p-3 shadow-sm">
        <Skeleton className="h-6 w-full rounded-md" />
        <div className="mt-3 flex justify-end">
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="w-full min-w-0 rounded-xl border border-border/70 bg-card p-3 shadow-sm"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-32 max-w-full" />
                    <Skeleton className="mt-1 h-3 w-24 max-w-full" />
                  </div>
                  <Skeleton className="h-3 w-24 shrink-0" />
                </div>
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
                <div className="mt-3 border-t border-border/60 pt-2">
                  <Skeleton className="h-6 w-16 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="ml-3 min-w-0 border-l border-border/80 pl-4 sm:ml-5 sm:pl-5">
          <div className="w-full min-w-0 rounded-xl border border-border/70 bg-background/95 p-3 shadow-sm">
            <div className="flex min-w-0 items-start gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-28 max-w-full" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryTabSkeleton() {
  return (
    <div className="scrollbar-none flex h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border bg-muted/10 p-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-full max-w-72" />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="relative min-w-0 pl-8">
            {index > 0 ? (
              <div className="absolute left-3.5 top-0 h-[calc(50%-0.875rem)] w-px -translate-x-1/2 bg-border" />
            ) : null}
            {index < 3 ? (
              <div className="absolute -bottom-4 left-3.5 top-[calc(50%+0.875rem)] w-px -translate-x-1/2 bg-border" />
            ) : null}
            <Skeleton className="absolute left-3.5 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full" />
            <div className="relative rounded-xl border bg-background p-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-28 max-w-full" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  {index % 2 === 0 ? (
                    <Skeleton className="mt-2 h-4 w-3/4" />
                  ) : null}
                </div>
                <div className="flex min-w-0 max-w-full flex-col items-start gap-2 sm:shrink-0 sm:items-end">
                  <Skeleton className="h-5 w-28 max-w-full rounded-full" />
                  <Skeleton className="h-4 w-24 max-w-full rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
const EXPIRY_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Karachi',
})
