import {
  Activity,
  addTransitionType,
  startTransition,
  Suspense,
  useRef,
  useState,
  ViewTransition,
} from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock3,
  Copy,
  Mail,
  MailCheck,
  MessageSquareMore,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  UserRoundPlus,
} from 'lucide-react'

import { EmailDeliveryBadge } from '#/components/case-email/email-delivery-badge'
import { Button } from '#/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Card, CardContent } from '#/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { useAuth } from '#/features/auth/auth-client'
import {
  caseHistoryQueryOptions,
  useAdvanceStage,
  useCloseUnsuccessful,
  useMoveCaseBackToWorking,
  useRegenerateResubmissionLink,
  useSaveDocumentReviewSubMerchant,
  useTakeOwnership,
} from '#/hooks/use-case-detail-query'
import { useMorph } from '#/hooks/use-morph'
import { cn } from '#/lib/utils'
import { skipActiveViewTransition } from '#/lib/view-transition'
import type { CaseDetail } from '#/schemas/cases.schema'
import { formatExpiryLabel, NO_EXPIRY_LABEL } from '#/lib/expiry'

import { AgreementRoundsCard } from './agreement-rounds-card'
import { CaseChatter } from './case-chatter'
import { CaseHistoryTimeline } from './case-history-timeline'
import { ResolutionActionCardSkeleton } from './case-detail-skeletons'
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

const DOCUMENT_REVIEW_LINK_ACTIONS = new Set([
  'resubmission_link_regenerated',
  'resubmission_email_sent',
  'resubmission_email_sent_manual',
  'resubmission_whatsapp_sent_manual',
])
const AGREEMENT_LINK_ACTIONS = new Set(['agreement_email_sent'])

interface CaseSidePanelProps {
  caseDetail: CaseDetail
  caseId: string
}

type SidePanelTab = 'resolution' | 'chatter' | 'history'
// Tab order, for the direction the panel slides on a tab change.
const SIDE_PANEL_TABS: SidePanelTab[] = ['resolution', 'chatter', 'history']

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
    status === 'closed' ||
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

  if (options.isAgreementCase && status === 'awaiting_merchant') {
    return {
      title: 'Awaiting physical signed copy',
      description:
        'The agreement link was sent to the merchant. They must print, sign, and courier the physical copy to the office. Upload the scan when it arrives.',
      actionLabel: null,
      actionKind: 'agreement' as const,
    }
  }

  if (status === 'awaiting_merchant') {
    return {
      title: 'Awaiting merchant',
      description:
        'A resubmission email was sent to the merchant. The case will return to working once they submit the requested updates.',
      actionLabel: null,
      actionKind: 'awaiting-merchant' as const,
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
        ? 'Open the Agreement workspace, review the final agreement, then send mail to the merchant.'
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
        'Open the review summary, confirm the rejected fields, and email the merchant to request a resubmission.',
      actionLabel: 'Review',
      actionKind: 'review' as const,
    }
  }

  if (status === 'working') {
    return {
      title: 'Working stage',
      description:
        'Finish the active review work for this case, then close it successfully.',
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
  // Morph Dialog: the review modal grows out of the Review button, then
  // closes with the regular dialog fade/zoom like every other modal.
  const reviewModal = useMorph({ morphClose: false })
  // Bumped on every open so the modal starts fresh, while staying mounted
  // after close so its exit animation can play.
  const [reviewModalKey, setReviewModalKey] = useState(0)
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
  const isClosed = category === 'closed'
  const isNew = category === 'new'
  const isInProgress = category === 'in_progress'
  const showPrimaryActionButton =
    primaryAction.actionKind !== 'awaiting-merchant' &&
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
        .then(() => {
          reviewModal.setOpen(true, {
            alongside: () => setReviewModalKey((key) => key + 1),
          })
        })
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
            const to = SIDE_PANEL_TABS.indexOf(value as SidePanelTab)
            const from = SIDE_PANEL_TABS.indexOf(sidePanelTab)
            if (to < 0 || to === from) return
            // Morph UI Tabs, like the merchant detail tabs: the panel slides
            // toward the picked tab (vt-slide, see the ViewTransition below).
            skipActiveViewTransition()
            startTransition(() => {
              addTransitionType(to > from ? 'tab-next' : 'tab-prev')
              if (value === 'chatter') setVisitedChatter(true)
              if (value === 'history') setVisitedHistory(true)
              setSidePanelTab(SIDE_PANEL_TABS[to])
            })
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

          <ViewTransition
            update={{
              'tab-next': 'vt-slide vt-quick vt-clip vt-forward',
              'tab-prev': 'vt-slide vt-quick vt-clip vt-back',
              default: 'none',
            }}
          >
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
              <TabsContent
                value="resolution"
                className="min-h-0 w-full min-w-0 flex-1 overflow-hidden not-data-hidden:flex data-hidden:hidden"
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
                          <AlertDescription className="min-w-0 wrap-break-word">
                            {caseDetail.case.closeReason}
                          </AlertDescription>
                        ) : null}
                      </Alert>
                    ) : null}

                    {!isClosed &&
                    caseDetail.emailDelivery &&
                    !caseDetail.emailDelivery.supersededByManual ? (
                      <CaseEmailDeliveryNotice
                        caseId={caseId}
                        delivery={caseDetail.emailDelivery}
                        canMoveBackToWorking={
                          isCaseOwner && status === 'awaiting_merchant'
                        }
                      />
                    ) : null}

                    {!isClosed ? (
                      <div className="rounded-xl border bg-background p-3">
                        <div className="flex flex-col gap-2">
                          <p className="text-sm text-muted-foreground">
                            {primaryAction.actionKind === 'take-ownership'
                              ? 'Take ownership first to move the case into active review.'
                              : primaryAction.actionKind === 'review'
                                ? isCaseOwner
                                  ? 'Review the rejected fields and email the merchant to request a resubmission.'
                                  : 'Only the current case owner can review rejected fields and request a resubmission.'
                                : primaryAction.actionKind ===
                                    'awaiting-merchant'
                                  ? 'Waiting for the merchant to update the requested fields.'
                                  : primaryAction.actionKind ===
                                      'sub-merchant-form'
                                    ? 'Upload the Final Form for the inherited sub-merchant in the case workspace.'
                                    : primaryAction.actionKind ===
                                        'mid-creation'
                                      ? 'Save the email, MID, and Branch Code for both merchant IDs before closing this case.'
                                      : primaryAction.actionKind === 'testing'
                                        ? 'Complete testing limits and send credentials by auto Resend, manual Gmail, or WhatsApp in the case workspace.'
                                        : primaryAction.actionKind ===
                                            'agreement'
                                          ? 'Send the final agreement link to the merchant, then upload the scanned physical copy when it arrives.'
                                          : isCaseOwner
                                            ? 'When everything checks out, close this case successfully.'
                                            : 'Only the current case owner can complete this case.'}
                          </p>
                          {showPrimaryActionButton ? (
                            <Button
                              {...(primaryAction.actionKind === 'review'
                                ? reviewModal.triggerProps
                                : null)}
                              onClick={handlePrimaryAction}
                              disabled={
                                actionPending ||
                                (primaryAction.actionKind !==
                                  'take-ownership' &&
                                  primaryAction.actionKind !==
                                    'mark-successful' &&
                                  primaryAction.actionKind !== 'review') ||
                                (primaryAction.actionKind === 'review' &&
                                  (!hasActiveRejections || !isCaseOwner)) ||
                                (primaryAction.actionKind ===
                                  'mark-successful' &&
                                  ((hasOwner && !isCaseOwner) ||
                                    // The latest merchant email isn't
                                    // delivered (the server refuses too).
                                    Boolean(
                                      caseDetail.emailDelivery
                                        ?.closeBlockedReason,
                                    )))
                              }
                            >
                              {/* Spinner and label both follow
                              primaryButtonPending, which is set on click, so
                              the spinner shows at once, including while a
                              sub-merchant save runs before the action. */}
                              {primaryButtonPending ? (
                                <Spinner data-icon="inline-start" />
                              ) : primaryAction.actionKind ===
                                'take-ownership' ? (
                                <UserRoundPlus data-icon="inline-start" />
                              ) : primaryAction.actionKind === 'review' ? (
                                <Send data-icon="inline-start" />
                              ) : (
                                <CheckCircle2 data-icon="inline-start" />
                              )}
                              {primaryAction.actionKind === 'take-ownership'
                                ? primaryButtonPending
                                  ? 'Taking ownership'
                                  : 'Take ownership'
                                : primaryAction.actionKind === 'review'
                                  ? primaryButtonPending
                                    ? 'Opening review'
                                    : 'Review'
                                  : primaryAction.actionKind ===
                                      'mark-successful'
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
                    status === 'awaiting_merchant' ? (
                      <AwaitingMerchantAlert
                        caseId={caseId}
                        actionSet={DOCUMENT_REVIEW_LINK_ACTIONS}
                        title="Awaiting merchant resubmission"
                        showLinkExpiry={false}
                        description="We emailed the merchant a secure link to update the rejected fields. The case will return to working as soon as they submit."
                        canRegenerate={isCaseOwner}
                      />
                    ) : null}

                    {isAgreementCase &&
                    hasOwner &&
                    status === 'awaiting_merchant' ? (
                      <AwaitingMerchantAlert
                        caseId={caseId}
                        actionSet={AGREEMENT_LINK_ACTIONS}
                        title="Awaiting physical signed copy"
                        description="The agreement link was sent to the merchant. After they print, sign, and courier the physical agreement to the office, upload the scanned copy in the Agreement workspace. The case will return to Working after upload."
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
                          All document-review items are approved in the
                          database. You can now mark this case as successful.
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
                        This case is not in a stage that can be resolved from
                        the side panel yet.
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
                keepMounted={visitedChatter}
                className="min-h-0 w-full min-w-0 flex-1 overflow-hidden not-data-hidden:flex data-hidden:hidden"
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
                keepMounted={visitedHistory}
                className="min-h-0 w-full min-w-0 flex-1 overflow-hidden not-data-hidden:flex data-hidden:hidden"
              >
                <KeepAliveTabBody
                  visited={visitedHistory}
                  active={sidePanelTab === 'history'}
                  fallback={<HistoryTabSkeleton />}
                >
                  <CaseHistoryTimeline caseId={caseId} embedded />
                </KeepAliveTabBody>
              </TabsContent>
            </div>
          </ViewTransition>
        </Tabs>
      </CardContent>

      {isDocumentReviewCase && reviewModalKey > 0 ? (
        <DocumentsReviewSummaryModal
          key={reviewModalKey}
          open={reviewModal.open}
          onOpenChange={reviewModal.onOpenChange}
          popupProps={reviewModal.popupProps}
          caseDetail={caseDetail}
          caseId={caseId}
          reviewSummary={reviewSummary}
        />
      ) : null}
    </Card>
  )
}

function AwaitingMerchantAlert({
  caseId,
  actionSet,
  title,
  description,
  canRegenerate = false,
  showLinkExpiry = true,
}: {
  caseId: string
  actionSet: ReadonlySet<string>
  title: string
  description: string
  canRegenerate?: boolean
  /** Document-review resubmission links never expire. */
  showLinkExpiry?: boolean
}) {
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))
  const regenerateLink = useRegenerateResubmissionLink(caseId)
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  // The confirmation grows out of the Regenerate link button.
  const regenerateMorph = useMorph()

  const expiresAt = (() => {
    const items = historyQuery.data
    if (!showLinkExpiry || !items) return null
    const latest = items.find((historyEntry) =>
      actionSet.has(historyEntry.action),
    )
    const details = latest?.details as
      { expiresAt?: string | null } | null | undefined
    return details?.expiresAt ?? null
  })()

  const expiresLabel = formatExpiryLabel(expiresAt, (date) =>
    EXPIRY_DATE_TIME_FORMATTER.format(date),
  )
  const regeneratedLink = regenerateLink.data?.url ?? null
  const regeneratedFieldCount = regenerateLink.data?.rejectedFieldCount ?? 0

  async function handleCopyLink() {
    if (!regeneratedLink) return
    try {
      await navigator.clipboard.writeText(regeneratedLink)
      toast.success('Resubmission link copied')
    } catch {
      toast.error('Could not copy the link. Select and copy it manually.')
    }
  }

  async function handleRegenerateLink() {
    try {
      await regenerateLink.mutateAsync()
      setRegenerateDialogOpen(false)
    } catch {
      // The mutation hook displays the backend error and keeps the dialog open.
    }
  }

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
        {regeneratedLink ? (
          <div className="mt-2 flex w-full min-w-0 flex-col gap-2">
            <p>
              New link generated for {regeneratedFieldCount} current rejected
              field{regeneratedFieldCount === 1 ? '' : 's'}.
            </p>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Input
                value={regeneratedLink}
                readOnly
                aria-label="New resubmission link"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={handleCopyLink}>
                <Copy data-icon="inline-start" />
                Copy link
              </Button>
            </div>
          </div>
        ) : null}
        {canRegenerate ? (
          <AlertDialog
            open={regenerateDialogOpen}
            onOpenChange={(next) => {
              if (next) regenerateMorph.run(() => setRegenerateDialogOpen(true))
              else setRegenerateDialogOpen(false)
            }}
          >
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  {...regenerateMorph.triggerProps}
                />
              }
            >
              <RefreshCw data-icon="inline-start" />
              Regenerate link
            </AlertDialogTrigger>
            <AlertDialogContent {...regenerateMorph.popupProps}>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Regenerate resubmission link?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The current link will stop working immediately. The new link
                  will include the latest rejected fields on this case.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={regenerateLink.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault()
                    void handleRegenerateLink()
                  }}
                  disabled={regenerateLink.isPending}
                >
                  {regenerateLink.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <RefreshCw data-icon="inline-start" />
                  )}
                  {regenerateLink.isPending
                    ? 'Generating link'
                    : 'Regenerate link'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

const UNDELIVERED_STATUSES = new Set([
  'bounced',
  'complained',
  'suppressed',
  'failed',
])

/**
 * The case's latest merchant email and its Resend delivery status. Closing
 * successfully waits for it to be delivered; a bounce says what to do next.
 */
function CaseEmailDeliveryNotice({
  caseId,
  delivery,
  canMoveBackToWorking,
}: {
  caseId: string
  delivery: NonNullable<CaseDetail['emailDelivery']>
  /** Owner of an Awaiting Merchant case: resending needs Working. */
  canMoveBackToWorking: boolean
}) {
  const moveBackToWorking = useMoveCaseBackToWorking(caseId)
  const undelivered = UNDELIVERED_STATUSES.has(delivery.status)
  const showMoveBack =
    canMoveBackToWorking &&
    (undelivered || delivery.status === 'delivery_delayed')
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border bg-background p-3',
        undelivered && 'border-destructive/40',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Mail
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {delivery.templateLabel} email
            </p>
            <p className="wrap-anywhere text-xs text-muted-foreground">
              To {delivery.recipient}
              {delivery.cc.length > 0 ? ` · Cc ${delivery.cc.join(', ')}` : ''}
            </p>
          </div>
        </div>
        <EmailDeliveryBadge
          status={delivery.status}
          detail={delivery.detail}
          updatedAt={delivery.statusUpdatedAt}
          className="shrink-0"
        />
      </div>
      {delivery.closeBlockedReason ? (
        <p
          className={cn(
            'text-sm text-pretty',
            undelivered ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {delivery.closeBlockedReason}
        </p>
      ) : null}
      {showMoveBack ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={moveBackToWorking.isPending}
          onClick={() => moveBackToWorking.mutate()}
        >
          {moveBackToWorking.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCcw data-icon="inline-start" />
          )}
          Move back to Working
        </Button>
      ) : null}
    </div>
  )
}

function ResolutionTabSkeleton() {
  return (
    <div className="scrollbar-none flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      {/* Same card as the page skeleton's side panel, so this fallback and
          the real card line up. */}
      <ResolutionActionCardSkeleton />

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
      {/* Bars match the real line heights: the heading and actor names are
          text-sm (20px lines), details are leading-6 (24px lines). */}
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/5" />
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
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-28 max-w-full" />
                  <div className="flex flex-col">
                    <div className="flex h-6 items-center">
                      <Skeleton className="h-4 w-full" />
                    </div>
                    {index % 2 === 0 ? (
                      <div className="flex h-6 items-center">
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : null}
                  </div>
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
