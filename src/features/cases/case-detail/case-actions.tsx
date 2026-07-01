import { useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  ShieldAlert,
  UserRoundPlus,
  Workflow,
} from 'lucide-react'

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
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import type { CaseDetail } from '#/schemas/cases.schema'
import {
  useAdvanceStage,
  useCloseUnsuccessful,
  useTakeOwnership,
} from '#/hooks/use-case-detail-query'

interface CaseActionsProps {
  caseDetail: CaseDetail
  caseId: string
}

export function CaseActions({ caseDetail, caseId }: CaseActionsProps) {
  const { currentStage, owner } = caseDetail
  const category = currentStage?.category ?? null

  const takeOwnership = useTakeOwnership(caseId)
  const advanceStage = useAdvanceStage(caseId)
  const closeUnsuccessful = useCloseUnsuccessful(caseId)

  const [closeReason, setCloseReason] = useState('')
  const [actionInFlight, setActionInFlight] = useState<
    'primary' | 'unsuccessful' | null
  >(null)
  const actionLockedRef = useRef(false)

  const isClosed = category === 'closed' || category === 'error'
  const isNew = category === 'new'
  const isInProgress = category === 'in_progress'
  const hasOwner = Boolean(owner)
  const isTestingCase = caseDetail.queue.slug === 'testing'
  const testingLimitsApplied = Boolean(caseDetail.testing?.limitsAppliedAt)
  const isWordpressWebsiteCase = caseDetail.queue.slug === 'wordpress-website'
  const isDialogPayCardCase = caseDetail.queue.slug === 'dialogpay-card'
  const wordpressWebsiteReady = Boolean(
    caseDetail.wordpressWebsite?.clonedWebsiteLink &&
      caseDetail.wordpressWebsite.screenshots.length > 0 &&
      caseDetail.wordpressWebsite.subMerchantLogoScreenshots.length > 0 &&
      caseDetail.testing?.internalLimitsAppliedAt,
  )
  const successfulActionPending =
    actionInFlight === 'primary' ||
    takeOwnership.isPending ||
    advanceStage.isPending
  const unsuccessfulActionPending =
    actionInFlight === 'unsuccessful' || closeUnsuccessful.isPending
  const actionPending = successfulActionPending || unsuccessfulActionPending
  const successfulActionDisabled =
    actionPending ||
    (isTestingCase && !testingLimitsApplied) ||
    (isWordpressWebsiteCase && !wordpressWebsiteReady)
  const successfulActionLabel = isDialogPayCardCase
    ? getDialogPayActionLabel(currentStage?.slug)
    : isTestingCase || isWordpressWebsiteCase
      ? 'Mark as successful'
      : 'Submit and advance'
  const pendingSuccessfulActionLabel = isDialogPayCardCase
    ? 'Saving update'
    : 'Closing case'

  const summary = useMemo(() => {
    if (isClosed) {
      return {
        title: 'Case closed',
        description:
          caseDetail.case.closeOutcome === 'successful'
            ? 'The workflow is complete and the case has been closed successfully.'
            : 'The case has been closed as unsuccessful.',
      }
    }

    if (isNew && !hasOwner) {
      return {
        title: 'Ownership required',
        description:
          'Take ownership to move this case into active review and unlock case actions.',
      }
    }

    if (isInProgress) {
      if (isDialogPayCardCase) {
        return {
          title: getDialogPaySummaryTitle(currentStage?.slug),
          description:
            'Use these actions to record the work and approvals completed on the DialogPay portal.',
        }
      }

      return {
        title: 'Ready for review actions',
        description:
          'When review notes are saved and the case is ready, submit it to the next stage or close it as unsuccessful.',
      }
    }

    return {
      title: 'Workflow actions',
      description:
        'Available actions depend on the current stage and ownership.',
    }
  }, [
    caseDetail.case.closeOutcome,
    currentStage?.slug,
    hasOwner,
    isClosed,
    isDialogPayCardCase,
    isInProgress,
    isNew,
  ])

  async function runWorkflowAction(
    kind: 'primary' | 'unsuccessful',
    action: () => Promise<unknown>,
  ) {
    if (actionPending || actionLockedRef.current) return
    actionLockedRef.current = true
    setActionInFlight(kind)

    try {
      await action()
    } finally {
      actionLockedRef.current = false
      setActionInFlight(null)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Workflow actions</CardTitle>
            <CardDescription>{summary.description}</CardDescription>
          </div>
          {currentStage ? (
            <Badge variant={isClosed ? 'destructive' : 'secondary'}>
              {currentStage.name}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border bg-background">
              {isClosed ? (
                <CheckCircle2 className="size-4 text-muted-foreground" />
              ) : (
                <Workflow className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">{summary.title}</p>
              <p className="text-sm text-muted-foreground">
                {owner
                  ? `Assigned to ${owner.name}.`
                  : 'No case owner assigned yet.'}
              </p>
            </div>
          </div>
        </div>

        {isNew && !hasOwner ? (
          <Button
            onClick={() =>
              runWorkflowAction('primary', () => takeOwnership.mutateAsync())
            }
            disabled={actionPending}
          >
            {successfulActionPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UserRoundPlus data-icon="inline-start" />
            )}
            {successfulActionPending ? 'Taking ownership' : 'Take ownership'}
          </Button>
        ) : null}

        {isInProgress ? (
          <Button
            onClick={() =>
              runWorkflowAction('primary', () => advanceStage.mutateAsync())
            }
            disabled={successfulActionDisabled}
          >
            {successfulActionPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <CheckCircle2 data-icon="inline-start" />
            )}
            {successfulActionPending
              ? pendingSuccessfulActionLabel
              : successfulActionLabel}
          </Button>
        ) : null}

        {!isClosed && hasOwner ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={actionPending}>
                {unsuccessfulActionPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <ShieldAlert data-icon="inline-start" />
                )}
                {unsuccessfulActionPending ? 'Closing case' : 'Reject case'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close case as unsuccessful</AlertDialogTitle>
                <AlertDialogDescription>
                  This action moves the case to its closed stage. Provide a
                  clear reason so the closure is visible in the case record and
                  history.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="close-reason">
                    Closure remarks
                  </FieldLabel>
                  <Textarea
                    id="close-reason"
                    value={closeReason}
                    onChange={(event) => setCloseReason(event.target.value)}
                    placeholder="Explain why the case is being rejected or closed."
                    className="min-h-28"
                  />
                  <FieldDescription>
                    Required before the case can be closed unsuccessfully.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!closeReason.trim() || actionPending}
                  onClick={() =>
                    runWorkflowAction('unsuccessful', () =>
                      closeUnsuccessful.mutateAsync({
                        reason: closeReason.trim(),
                      }),
                    )
                  }
                >
                  {unsuccessfulActionPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  {unsuccessfulActionPending ? 'Closing case' : 'Close case'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {isClosed && caseDetail.case.closeReason ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-destructive">
              Closure remarks
            </p>
            <p className="mt-1 text-sm">{caseDetail.case.closeReason}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function getDialogPaySummaryTitle(stageSlug: string | undefined) {
  switch (stageSlug) {
    case 'working':
      return 'Create merchant on DialogPay'
    case 'merchant_pending':
      return 'Waiting for merchant approval'
    case 'docs_upload':
      return 'Upload merchant documents'
    case 'docs_pending':
      return 'Waiting for document approval'
    default:
      return 'DialogPay workflow'
  }
}

function getDialogPayActionLabel(stageSlug: string | undefined) {
  switch (stageSlug) {
    case 'working':
      return 'Mark merchant created'
    case 'merchant_pending':
      return 'Mark merchant approved'
    case 'docs_upload':
      return 'Mark documents uploaded'
    case 'docs_pending':
      return 'Mark documents approved'
    default:
      return 'Submit and advance'
  }
}
