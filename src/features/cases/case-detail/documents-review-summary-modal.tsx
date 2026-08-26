import { useRef, useState } from 'react'
import { Send, ShieldAlert } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

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
import { EmailModeChoice } from '#/components/case-email/email-mode-choice'
import { EmailRecipientSelect } from '#/components/case-email/email-recipient-select'
import { ManualEmailPanel } from '#/components/case-email/manual-email-panel'
import { WhatsAppMessagePanel } from '#/components/case-email/whatsapp-message-panel'
import { useAuth } from '#/features/auth/auth-client'
import {
  useSendForResubmission,
  useFetchResubmissionEmailPreview,
  useConfirmResubmissionEmailManual,
} from '#/hooks/use-case-detail-query'
import { emailSendingModeQueryOptions } from '#/hooks/use-configuration-query'
import type { CaseDetail, EmailRecipientType } from '#/schemas/cases.schema'
import type { EmailPreviewResult } from '#/apis/cases'
import { resolveQueueWorkflowType } from './queue-registry'

import type { getDocumentsReviewSummary } from './renderers/documents-review-shared'

type ReviewSummary = ReturnType<typeof getDocumentsReviewSummary>

interface DocumentsReviewSummaryModalProps {
  onOpenChange: (open: boolean) => void
  caseDetail: CaseDetail
  caseId: string
  reviewSummary: ReviewSummary | null
}

export function DocumentsReviewSummaryModal({
  onOpenChange,
  caseDetail,
  caseId,
  reviewSummary,
}: DocumentsReviewSummaryModalProps) {
  const { user } = useAuth()
  const {
    data: emailModeSettings,
    isError: isEmailModeError,
    refetch: refetchEmailMode,
  } = useQuery(emailSendingModeQueryOptions())
  const sendForResubmission = useSendForResubmission(caseId)
  const fetchPreview = useFetchResubmissionEmailPreview(caseId)
  const confirmManual = useConfirmResubmissionEmailManual(caseId)
  const isConfirmingRef = useRef(false)
  const [preview, setPreview] = useState<EmailPreviewResult | null>(null)
  const [recipientEmailType, setRecipientEmailType] =
    useState<EmailRecipientType>('submitter')

  const merchant = caseDetail.merchant as {
    submitterEmail?: string | null
    businessEmail?: string | null
    activeWhatsappNumber?: string | null
  } | null
  const submitterEmail = merchant?.submitterEmail ?? null
  const businessEmail = merchant?.businessEmail ?? null
  const selectedEmail =
    recipientEmailType === 'business' ? businessEmail : submitterEmail
  const activeWhatsappNumber = merchant?.activeWhatsappNumber ?? null
  const rejectedItems = reviewSummary?.rejectedItems ?? []

  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const hasRejections = rejectedItems.length > 0
  const hasRecipient = Boolean(selectedEmail)
  const isDocumentsReviewCase =
    resolveQueueWorkflowType(caseDetail.queue) === 'document_review'
  const isWorkingStage =
    caseDetail.case.status === 'working' &&
    caseDetail.currentStage?.category === 'in_progress'
  const canTrigger =
    hasRejections &&
    hasRecipient &&
    isCaseOwner &&
    isDocumentsReviewCase &&
    isWorkingStage
  const canLoadMessage =
    canTrigger ||
    (hasRejections &&
      hasRecipient &&
      isCaseOwner &&
      isDocumentsReviewCase &&
      caseDetail.case.status === 'awaiting_client')

  async function handleAutoConfirm() {
    if (!canTrigger || isConfirmingRef.current) return
    isConfirmingRef.current = true
    await sendForResubmission
      .mutateAsync({ recipientEmailType })
      .then((data) => {
        if (data.status === 'sent') setPreview(null)
      })
      .catch(() => {
        // Mutation hook already surfaces the backend error via toast.
      })
      .finally(() => {
        isConfirmingRef.current = false
      })
  }

  async function handleLoadPreview() {
    if (!canLoadMessage) return
    const data = await fetchPreview.mutateAsync({ recipientEmailType })
    setPreview(data)
  }

  async function handleManualConfirm(
    file: File,
    channel: 'email' | 'whatsapp',
  ) {
    if (!preview || isConfirmingRef.current) return
    isConfirmingRef.current = true
    await confirmManual
      .mutateAsync({
        tokenId: preview.tokenId,
        file,
        channel,
        recipientEmailType,
      })
      .then(() => {
        if (channel === 'whatsapp') onOpenChange(false)
      })
      .finally(() => {
        isConfirmingRef.current = false
      })
  }

  const autoContent = (
    <div className="flex flex-col gap-4">
      <EmailRecipientSelect
        value={recipientEmailType}
        onValueChange={(value) => {
          setRecipientEmailType(value)
          setPreview(null)
        }}
        submitterEmail={submitterEmail}
        businessEmail={businessEmail}
        disabled={sendForResubmission.isPending}
      />
      {hasRejections ? (
        <RejectionsList items={rejectedItems} />
      ) : (
        <EmptyState />
      )}
      <EmailRecipientSelect
        value={recipientEmailType}
        onValueChange={(value) => {
          setRecipientEmailType(value)
          setPreview(null)
        }}
        submitterEmail={submitterEmail}
        businessEmail={businessEmail}
        disabled={fetchPreview.isPending || confirmManual.isPending}
      />
      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={sendForResubmission.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAutoConfirm}
          disabled={!canTrigger || sendForResubmission.isPending}
        >
          {sendForResubmission.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Send data-icon="inline-start" />
          )}
          {sendForResubmission.isPending ? 'Sending email' : 'Confirm and send'}
        </Button>
      </DialogFooter>
    </div>
  )

  const manualContent = (
    <div className="flex flex-col gap-4">
      {hasRejections ? (
        <RejectionsList items={rejectedItems} />
      ) : (
        <EmptyState />
      )}
      <EmailRecipientSelect
        value={recipientEmailType}
        onValueChange={(value) => {
          setRecipientEmailType(value)
          setPreview(null)
        }}
        submitterEmail={submitterEmail}
        businessEmail={businessEmail}
        disabled={fetchPreview.isPending || confirmManual.isPending}
      />
      {!preview ? (
        <Button
          onClick={handleLoadPreview}
          disabled={!canTrigger || fetchPreview.isPending}
          variant="outline"
        >
          {fetchPreview.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Send data-icon="inline-start" />
          )}
          {fetchPreview.isPending ? 'Loading preview…' : 'Load email preview'}
        </Button>
      ) : (
        <ManualEmailPanel
          preview={preview}
          onConfirm={(file) => handleManualConfirm(file, 'email')}
          isPending={confirmManual.isPending}
        />
      )}
    </div>
  )

  const whatsappContent = (
    <div className="flex flex-col gap-4">
      {hasRejections ? (
        <RejectionsList items={rejectedItems} />
      ) : (
        <EmptyState />
      )}
      {!preview ? (
        <Button
          onClick={handleLoadPreview}
          disabled={!canLoadMessage || fetchPreview.isPending}
          variant="outline"
        >
          {fetchPreview.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Send data-icon="inline-start" />
          )}
          {fetchPreview.isPending
            ? 'Loading preview...'
            : 'Load WhatsApp message'}
        </Button>
      ) : (
        <WhatsAppMessagePanel
          preview={preview}
          phoneNumber={activeWhatsappNumber}
          onConfirm={(file) => handleManualConfirm(file, 'whatsapp')}
          isPending={confirmManual.isPending}
        />
      )}
    </div>
  )

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send for resubmission</DialogTitle>
          <DialogDescription>
            {!emailModeSettings
              ? isEmailModeError
                ? 'Load the current email settings before choosing a delivery workflow.'
                : 'Loading the available email workflows.'
              : emailModeSettings.autoEnabled && emailModeSettings.manualEnabled
                ? 'Choose to send automatically via Resend or manually via Gmail.'
                : emailModeSettings.autoEnabled
                  ? 'We will email the client a secure link to update only the rejected fields below.'
                  : 'Copy the subject and body below to send from Gmail, then upload a screenshot as proof.'}
          </DialogDescription>
        </DialogHeader>

        {emailModeSettings ? (
          <EmailModeChoice
            mode={emailModeSettings}
            autoContent={autoContent}
            manualContent={manualContent}
            whatsappContent={whatsappContent}
          />
        ) : isEmailModeError ? (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Email settings unavailable</AlertTitle>
            <AlertDescription>
              Email workflows are disabled until the current configuration can
              be loaded.
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetchEmailMode()}
            >
              Try again
            </Button>
          </Alert>
        ) : (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading email settings
          </div>
        )}
      </DialogContent>
    </Dialog>
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
    <Alert variant="warning">
      <ShieldAlert />
      <AlertTitle>No rejected fields</AlertTitle>
      <AlertDescription>
        Reject at least one field with remarks before sending the case back to
        the client.
      </AlertDescription>
    </Alert>
  )
}
