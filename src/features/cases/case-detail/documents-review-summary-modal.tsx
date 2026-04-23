import { Send, ShieldAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Spinner } from '#/components/ui/spinner'
import { useAuth } from '#/features/auth/auth-client'
import {
  useSendForResubmission,
} from '#/hooks/use-case-detail-query'
import type { CaseDetail } from '#/schemas/cases.schema'

import type { getDocumentsReviewSummary } from './renderers/documents-review-shared'

type ReviewSummary = ReturnType<typeof getDocumentsReviewSummary>

interface DocumentsReviewSummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseDetail: CaseDetail
  caseId: string
  reviewSummary: ReviewSummary | null
}

export function DocumentsReviewSummaryModal({
  open,
  onOpenChange,
  caseDetail,
  caseId,
  reviewSummary,
}: DocumentsReviewSummaryModalProps) {
  const { user } = useAuth()
  const sendForResubmission = useSendForResubmission(caseId)

  const merchant = caseDetail.merchant as
    | { submitterEmail?: string | null }
    | null
  const submitterEmail = merchant?.submitterEmail ?? null
  const rejectedItems = reviewSummary?.rejectedItems ?? []

  const isCaseOwner = Boolean(caseDetail.owner && user?.id === caseDetail.owner.id)
  const hasRejections = rejectedItems.length > 0
  const hasRecipient = Boolean(submitterEmail)
  const isDocumentsReviewCase = caseDetail.queue.slug === 'documents-review'
  const isWorkingStage =
    caseDetail.case.status === 'working' &&
    caseDetail.currentStage?.category === 'in_progress'
  const isSubmitting = sendForResubmission.isPending
  const canSubmit =
    hasRejections &&
    hasRecipient &&
    isCaseOwner &&
    isDocumentsReviewCase &&
    isWorkingStage &&
    !isSubmitting

  async function handleConfirm() {
    if (!canSubmit) return

    try {
      const data = await sendForResubmission.mutateAsync()

      if (data.status === 'sent') {
        onOpenChange(false)
      }
    } catch {
      // Mutation hooks already surface the backend error via toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send for resubmission</DialogTitle>
          <DialogDescription>
            We will email the client a secure link to update only the rejected
            fields below. The case will move to{' '}
            <span className="font-medium">Awaiting Client</span> until they
            submit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <RecipientPreview email={submitterEmail} />

          {hasRejections ? (
            <RejectionsList items={rejectedItems} />
          ) : (
            <EmptyState />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {isSubmitting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            {isSubmitting ? 'Sending email' : 'Confirm and send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecipientPreview({ email }: { email: string | null }) {
  if (!email) {
    return (
      <Alert variant="destructive">
        <ShieldAlert />
        <AlertTitle>No recipient on file</AlertTitle>
        <AlertDescription>
          We do not have a submitter email for this merchant. Add one before
          sending for resubmission.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Recipient
      </p>
      <p className="mt-1 text-sm font-medium">{email}</p>
    </div>
  )
}

function RejectionsList({
  items,
}: {
  items: ReviewSummary extends infer S
    ? S extends { rejectedItems: infer R }
      ? R
      : never
    : never
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {items.length} field{items.length === 1 ? '' : 's'} the client must
        update
      </p>
      <ScrollArea className="max-h-72 rounded-lg border">
        <div className="flex flex-col divide-y">
          {items.map((item) => (
            <div key={item.key} className="px-3 py-2">
              <p className="text-sm font-medium">{item.label}</p>
              {item.remarks ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.remarks}
                </p>
              ) : (
                <p className="mt-1 text-xs italic text-muted-foreground">
                  No remarks provided
                </p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function EmptyState() {
  return (
    <Alert>
      <ShieldAlert />
      <AlertTitle>No rejected fields</AlertTitle>
      <AlertDescription>
        Reject at least one field with remarks before sending the case back to
        the client.
      </AlertDescription>
    </Alert>
  )
}
