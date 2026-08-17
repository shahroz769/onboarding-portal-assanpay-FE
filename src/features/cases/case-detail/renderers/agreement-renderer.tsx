import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  MailCheck,
  Upload,
} from 'lucide-react'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { EmailModeChoice } from '#/components/case-email/email-mode-choice'
import { EmailRecipientSelect } from '#/components/case-email/email-recipient-select'
import { ManualEmailPanel } from '#/components/case-email/manual-email-panel'
import { WhatsAppMessagePanel } from '#/components/case-email/whatsapp-message-panel'
import { useAuth } from '#/features/auth/auth-client'
import {
  useSendAgreementEmail,
  useUploadAgreementFinalAgreement,
  useFetchAgreementEmailPreview,
  useConfirmAgreementEmailManual,
} from '#/hooks/use-case-detail-query'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'
import type { EmailPreviewResult } from '#/apis/cases'
import { MAX_FILE_SIZE_BYTES } from '#/lib/file-limits'
import { cn } from '#/lib/utils'
import type { EmailRecipientType } from '#/schemas/cases.schema'
import { MERCHANT_TYPES } from '#/schemas/merchant-onboarding.schema'

import type { QueueRendererProps } from '../queue-registry'

const ACCEPTED_AGREEMENT_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const
const ACCEPTED_AGREEMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const clientAgreementReviewSchema = z.object({
  remarks: z.string().trim().min(1, 'Remarks are required for resubmission.'),
})

type AgreementReviewContext = 'final' | 'client'

type AgreementReviewState = {
  open: boolean
  context: AgreementReviewContext
  remarks: string
  remarksError: string | null
  preview: EmailPreviewResult | null
  recipientEmailType: EmailRecipientType
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(fileName: string) {
  return fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
}

function validateAgreement(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Agreement must be 10 MB or smaller. Selected file is ${formatFileSize(file.size)}.`
  }

  if (
    !ACCEPTED_AGREEMENT_EXTENSIONS.includes(
      getFileExtension(
        file.name,
      ) as (typeof ACCEPTED_AGREEMENT_EXTENSIONS)[number],
    ) ||
    !ACCEPTED_AGREEMENT_TYPES.has(file.type)
  ) {
    return 'Agreement must be a PDF, DOC, or DOCX file.'
  }

  return null
}

function buildAgreementWhatsappBody(body: string) {
  return body
    .replace(
      /Please review and sign the agreement for (.+?) using the secure link below:/,
      'Please sign and upload the agreement for $1 using the secure link below:',
    )
    .replace(/\n\nIf you have any questions, please reply to this email\./, '')
}

export default function AgreementRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const { data: config } = useQuery(configurationQueryOptions())
  const uploadFinalAgreement = useUploadAgreementFinalAgreement(caseId)
  const sendAgreement = useSendAgreementEmail(caseId)
  const fetchPreview = useFetchAgreementEmailPreview(caseId)
  const confirmManual = useConfirmAgreementEmailManual(caseId)
  const [review, setReview] = useState<AgreementReviewState>({
    open: false,
    context: 'final',
    remarks: '',
    remarksError: null,
    preview: null,
    recipientEmailType: 'submitter',
  })
  const {
    open: reviewOpen,
    context: reviewContext,
    remarks,
    remarksError,
    preview,
    recipientEmailType,
  } = review
  const whatsappPreview = preview
    ? {
        ...preview,
        body: buildAgreementWhatsappBody(preview.body),
      }
    : null

  const emailMode = config?.emailSendingMode ?? {
    autoEnabled: true,
    manualEnabled: true,
  }

  const agreement = caseDetail.agreement ?? null
  const merchant = caseDetail.merchant
  const submitterEmail =
    typeof merchant.submitterEmail === 'string' ? merchant.submitterEmail : null
  const businessEmail =
    typeof merchant.businessEmail === 'string' ? merchant.businessEmail : null
  const activeWhatsappNumber =
    typeof merchant.activeWhatsappNumber === 'string'
      ? merchant.activeWhatsappNumber
      : null
  const merchantType = String(
    agreement?.businessType ?? merchant.merchantType ?? '',
  )
  const businessTypeLabel =
    MERCHANT_TYPES.find((option) => option.value === merchantType)?.label ||
    merchantType ||
    'Not available'
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canEdit = isCaseOwner && isWorking
  const hasClientAgreement = Boolean(agreement?.clientAgreement)
  const canReviewFinal =
    canEdit && Boolean(agreement?.finalAgreement) && !hasClientAgreement
  const canReviewClient = canEdit && hasClientAgreement

  function openReview(context: AgreementReviewContext) {
    setReview((current) => ({
      ...current,
      open: true,
      context,
      remarks: '',
      remarksError: null,
      preview: null,
    }))
  }

  async function handleAutoSend() {
    const trimmedRemarks = remarks.trim()
    if (reviewContext === 'client') {
      const result = clientAgreementReviewSchema.safeParse({
        remarks: trimmedRemarks,
      })
      if (!result.success) {
        setReview((current) => ({
          ...current,
          remarksError: result.error.issues[0]?.message ?? 'Remarks required.',
        }))
        return
      }
    }
    await sendAgreement.mutateAsync({
      remarks: trimmedRemarks || null,
      recipientEmailType,
    })
    setReview((current) => ({ ...current, preview: null }))
  }

  async function handleLoadPreview() {
    const trimmedRemarks = remarks.trim()
    if (reviewContext === 'client') {
      const result = clientAgreementReviewSchema.safeParse({
        remarks: trimmedRemarks,
      })
      if (!result.success) {
        setReview((current) => ({
          ...current,
          remarksError: result.error.issues[0]?.message ?? 'Remarks required.',
        }))
        return
      }
    }
    setReview((current) => ({ ...current, remarksError: null }))
    const data = await fetchPreview.mutateAsync({
      remarks: trimmedRemarks || null,
      recipientEmailType,
    })
    setReview((current) => ({ ...current, preview: data }))
  }

  async function handleManualConfirm(
    file: File,
    channel: 'email' | 'whatsapp',
  ) {
    if (!preview) return
    const trimmedRemarks = remarks.trim()
    await confirmManual.mutateAsync({
      tokenId: preview.tokenId,
      remarks: trimmedRemarks || null,
      file,
      channel,
      recipientEmailType,
    })
    if (channel === 'whatsapp') {
      setReview((current) => ({ ...current, open: false }))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Agreement</CardTitle>
              <CardDescription>
                Review the merchant business type, open the draft agreement,
                then upload the final agreement for client signing.
              </CardDescription>
            </div>
            {caseDetail.case.status === 'awaiting_client' ? (
              <Badge variant="secondary">
                <MailCheck />
                Awaiting client
              </Badge>
            ) : agreement?.clientAgreement ? (
              <Badge variant="secondary">
                <CheckCircle2 />
                Client submitted
              </Badge>
            ) : agreement?.finalAgreement ? (
              <Badge variant="secondary">
                <CheckCircle2 />
                Ready for review
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Business Type</FieldLabel>
              <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
                {businessTypeLabel}
              </div>
              <FieldDescription>
                The draft agreement is selected automatically from the business
                type submitted in the merchant form.
              </FieldDescription>
            </Field>

            {agreement ? (
              <Field>
                <FieldLabel>Draft Agreement</FieldLabel>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
                  <FileText className="text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {agreement.draftLabel}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Open the draft and prepare the final agreement manually.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <a
                      href={agreement.draftUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink data-icon="inline-start" />
                      Open draft
                    </a>
                  </Button>
                </div>
              </Field>
            ) : null}

            <Field data-disabled={!canEdit}>
              <FieldLabel>Final Agreement</FieldLabel>
              <AgreementUpload
                disabled={!canEdit}
                isUploading={uploadFinalAgreement.isPending}
                onUpload={(file) => uploadFinalAgreement.mutate({ file })}
              />

              <FieldDescription>
                Upload one completed PDF, DOC, or DOCX file. Maximum size is 1
                MB.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {agreement?.finalAgreement ? (
        <AgreementFileCard
          title="Final Agreement"
          description="This agreement will be sent to the client through a secure upload link."
          file={agreement.finalAgreement}
          action={
            canReviewFinal ? (
              <Button onClick={() => openReview('final')}>
                <MailCheck data-icon="inline-start" />
                Review
              </Button>
            ) : null
          }
        />
      ) : null}

      {agreement?.clientAgreement ? (
        <AgreementFileCard
          title="Client Submitted Agreement"
          description="Review the signed agreement submitted by the client."
          file={agreement.clientAgreement}
          action={
            canReviewClient ? (
              <Button onClick={() => openReview('client')}>
                <MailCheck data-icon="inline-start" />
                Review
              </Button>
            ) : null
          }
        />
      ) : null}

      {!canEdit && isWorking ? (
        <Alert variant="warning">
          <FileText />
          <AlertTitle>Owner action required</AlertTitle>
          <AlertDescription>
            Only the current case owner can upload the final agreement and send
            the client upload link.
          </AlertDescription>
        </Alert>
      ) : null}

      <Dialog
        open={reviewOpen}
        onOpenChange={(open) => setReview((current) => ({ ...current, open }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewContext === 'client'
                ? 'Review Client Agreement'
                : 'Review Agreement'}
            </DialogTitle>
            <DialogDescription>
              {reviewContext === 'client'
                ? 'Add remarks explaining why the submitted agreement needs to be corrected, then send a fresh secure upload link.'
                : 'Confirm the final agreement and send a secure upload link to the client.'}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <EmailRecipientSelect
              value={recipientEmailType}
              onValueChange={(value) => {
                setReview((current) => ({
                  ...current,
                  recipientEmailType: value,
                  preview: null,
                }))
              }}
              submitterEmail={submitterEmail}
              businessEmail={businessEmail}
              disabled={
                sendAgreement.isPending ||
                fetchPreview.isPending ||
                confirmManual.isPending
              }
            />

            <Field data-invalid={Boolean(remarksError)}>
              <FieldLabel htmlFor="agreement-remarks">Remarks</FieldLabel>
              <Textarea
                id="agreement-remarks"
                value={remarks}
                aria-invalid={Boolean(remarksError)}
                onChange={(event) => {
                  setReview((current) => ({
                    ...current,
                    remarks: event.target.value,
                    remarksError: null,
                    preview: null,
                  }))
                }}
                placeholder={
                  reviewContext === 'client'
                    ? 'Required. Explain what the client must correct.'
                    : 'Optional message for the client.'
                }
                className="min-h-28"
              />

              <FieldError>{remarksError}</FieldError>
            </Field>
          </FieldGroup>

          <EmailModeChoice
            mode={emailMode}
            autoContent={
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    setReview((current) => ({ ...current, open: false }))
                  }
                  disabled={sendAgreement.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAutoSend}
                  disabled={sendAgreement.isPending}
                >
                  {sendAgreement.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {sendAgreement.isPending ? 'Sending' : 'Send mail'}
                </Button>
              </DialogFooter>
            }
            manualContent={
              !preview ? (
                <Button
                  onClick={handleLoadPreview}
                  disabled={fetchPreview.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {fetchPreview.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {fetchPreview.isPending
                    ? 'Loading preview…'
                    : 'Load email preview'}
                </Button>
              ) : (
                <ManualEmailPanel
                  preview={preview}
                  onConfirm={(file) => handleManualConfirm(file, 'email')}
                  isPending={confirmManual.isPending}
                />
              )
            }
            whatsappContent={
              !preview ? (
                <Button
                  onClick={handleLoadPreview}
                  disabled={fetchPreview.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {fetchPreview.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {fetchPreview.isPending
                    ? 'Loading preview...'
                    : 'Load WhatsApp message'}
                </Button>
              ) : (
                <WhatsAppMessagePanel
                  preview={whatsappPreview ?? preview}
                  phoneNumber={activeWhatsappNumber}
                  onConfirm={(file) => handleManualConfirm(file, 'whatsapp')}
                  isPending={confirmManual.isPending}
                />
              )
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AgreementFileCard({
  title,
  description,
  file,
  action,
}: {
  title: string
  description: string
  file: {
    originalName: string
    sizeBytes: number
    googleDriveWebViewLink: string
  }
  action?: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
          <FileText className="text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.originalName}</p>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(file.sizeBytes)}
            </p>
          </div>
          <Button asChild variant="outline">
            <a
              href={file.googleDriveWebViewLink}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink data-icon="inline-start" />
              View agreement
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AgreementUpload({
  disabled,
  isUploading,
  onUpload,
}: {
  disabled: boolean
  isUploading: boolean
  onUpload: (file: File) => void
}) {
  const inputId = useId()
  const labelId = useId()
  const descriptionId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file: File | undefined) {
    if (!file || disabled || isUploading) return

    const validationError = validateAgreement(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    onUpload(file)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div
      data-slot="file-upload"
      dir="ltr"
      className="relative flex w-full flex-col gap-2"
    >
      <div
        role="region"
        id={descriptionId}
        aria-controls={inputId}
        aria-disabled={disabled || isUploading}
        aria-invalid={Boolean(error)}
        data-slot="file-upload-dropzone"
        data-disabled={disabled || isUploading ? true : undefined}
        data-dragging={isDragging ? true : undefined}
        data-invalid={error ? true : undefined}
        dir="ltr"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'relative flex min-h-40 select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 outline-none transition-colors hover:bg-accent/30 focus-visible:border-ring/50 data-disabled:pointer-events-none data-disabled:opacity-60 data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20',
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          handleFile(event.dataTransfer.files[0])
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full border-2 border-dashed border-muted-foreground/25 p-4">
            {isUploading ? (
              <Spinner className="size-8 text-muted-foreground" />
            ) : (
              <FileText className="size-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-semibold">
              {isUploading ? 'Uploading agreement' : 'Drop agreement here'}
            </p>
            <p className="text-sm text-muted-foreground">
              PDF, DOC, DOCX (max 10MB)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Upload data-icon="inline-start" />
            )}
            Browse Documents
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        accept={ACCEPTED_AGREEMENT_EXTENSIONS.join(',')}
        className="sr-only"
        type="file"
        disabled={disabled || isUploading}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <div id={labelId} className="sr-only">
        File upload
      </div>
      <FieldError>{error}</FieldError>
    </div>
  )
}
