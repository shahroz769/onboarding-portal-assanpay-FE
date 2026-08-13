import { useId, useRef, useState } from 'react'
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image,
  MailCheck,
  Save,
  Upload,
} from 'lucide-react'

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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useAuth } from '#/features/auth/auth-client'
import {
  useUploadSubMerchantEmailProof,
  useUploadSubMerchantFinalForm,
} from '#/hooks/use-case-detail-query'
import { cn } from '#/lib/utils'
import { KIN_RELATIONS } from '#/schemas/merchant-onboarding.schema'
import type { CaseDetail } from '#/schemas/cases.schema'

import type { QueueRendererProps } from '../queue-registry'

const MAX_FINAL_FORM_BYTES = 1024 * 1024
const MAX_EMAIL_PROOF_BYTES = 10 * 1024 * 1024
const ACCEPTED_FINAL_FORM_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const
const ACCEPTED_EMAIL_PROOF_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
] as const
const ACCEPTED_FINAL_FORM_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const ACCEPTED_EMAIL_PROOF_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const EMAIL_SUBJECT = 'Addition of one sub merchant to our account'
const RELATION_LABELS = new Map<string, string>(
  KIN_RELATIONS.map((option) => [option.value, option.label]),
)

type AttachmentLink = {
  label: string
  name: string
  viewUrl: string
  downloadUrl: string | null
}

type MerchantDocument = {
  documentType?: string | null
  originalName?: string | null
  googleDriveWebViewLink?: string | null
  googleDriveDownloadLink?: string | null
}

type CaseFileLink = {
  originalName: string
  googleDriveWebViewLink: string
  googleDriveDownloadLink: string | null
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(fileName: string) {
  return fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
}

function validateFinalForm(file: File) {
  if (file.size > MAX_FINAL_FORM_BYTES) {
    return `Final Form must be 1 MB or smaller. Selected file is ${formatFileSize(file.size)}.`
  }

  if (
    !ACCEPTED_FINAL_FORM_EXTENSIONS.includes(
      getFileExtension(
        file.name,
      ) as (typeof ACCEPTED_FINAL_FORM_EXTENSIONS)[number],
    ) ||
    !ACCEPTED_FINAL_FORM_TYPES.has(file.type)
  ) {
    return 'Final Form must be a PDF, DOC, or DOCX file.'
  }

  return null
}

function validateEmailProof(file: File) {
  if (file.size > MAX_EMAIL_PROOF_BYTES) {
    return `Email screenshot must be 10 MB or smaller. Selected file is ${formatFileSize(file.size)}.`
  }

  if (
    !ACCEPTED_EMAIL_PROOF_EXTENSIONS.includes(
      getFileExtension(
        file.name,
      ) as (typeof ACCEPTED_EMAIL_PROOF_EXTENSIONS)[number],
    ) ||
    !ACCEPTED_EMAIL_PROOF_TYPES.has(file.type)
  ) {
    return 'Email screenshot must be a JPG, PNG, or WEBP file.'
  }

  return null
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getNokRelationLabel(value: unknown) {
  const relation = getStringValue(value)
  return RELATION_LABELS.get(relation) ?? relation
}

function buildEmailBody({
  sellerCode,
  subMerchantName,
  businessName,
  website,
  nokRelation,
}: {
  sellerCode: string
  subMerchantName: string
  businessName: string
  website: string
  nokRelation: string
}) {
  return `Dear Easypaisa Team,

I hope this email finds you well.

I am writing on behalf of ${subMerchantName} to request the addition of a sub-merchants to our aggregator account. The seller code associated with our account is ${sellerCode}

Please find the details of the sub-merchants below:

Name: ${businessName}
Website: ${website}
NOK Relation: ${nokRelation}`
}

function downloadEmailDraft(body: string) {
  const content = `Subject\n${EMAIL_SUBJECT}\n\nBody\n${body}`
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'ep-sub-merchant-email.txt'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getDocumentLink(
  caseDetail: CaseDetail,
  documentType: string,
): AttachmentLink | null {
  const document = caseDetail.documents
    .map((item) => item as MerchantDocument)
    .find((item) => item.documentType === documentType)

  if (!document?.googleDriveWebViewLink) return null

  return {
    label: documentType,
    name: document.originalName ?? 'Uploaded document',
    viewUrl: document.googleDriveWebViewLink,
    downloadUrl: document.googleDriveDownloadLink ?? null,
  }
}

function toAttachmentLink(label: string, file: CaseFileLink): AttachmentLink {
  return {
    label,
    name: file.originalName,
    viewUrl: file.googleDriveWebViewLink,
    downloadUrl: file.googleDriveDownloadLink,
  }
}

function getEmailAttachments(caseDetail: CaseDetail): AttachmentLink[] {
  const details = caseDetail.subMerchantForm ?? null
  const logoScreenshots =
    caseDetail.wordpressWebsite?.subMerchantLogoScreenshots.flatMap((file) =>
      file.subMerchantId == null ||
      file.subMerchantId === details?.subMerchantKey
        ? [toAttachmentLink('LOGO SCREENSHOT', file)]
        : [],
    ) ?? []
  const requiredDocuments = [
    ['OWNER CNIC FRONT', 'owner_cnic_front'],
    ['OWNER CNIC BACK', 'owner_cnic_back'],
    ['NOK CNIC FRONT', 'next_of_kin_cnic_front'],
    ['NOK CNIC BACK', 'next_of_kin_cnic_back'],
    ['NTN (WITH COMPANY NAME MENTIONED)', 'company_ntn'],
  ].flatMap(([label, documentType]) => {
    const link = getDocumentLink(caseDetail, documentType)
    return link ? [{ ...link, label }] : []
  })
  const finalForm = details?.finalForm
    ? [toAttachmentLink('SUB-MERCHANT REQUEST SCANNED', details.finalForm)]
    : []

  return [...logoScreenshots, ...requiredDocuments, ...finalForm]
}

export default function SubMerchantFormRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const uploadFinalForm = useUploadSubMerchantFinalForm(caseId)
  const uploadEmailProof = useUploadSubMerchantEmailProof(caseId)
  const [emailProofFile, setEmailProofFile] = useState<File | null>(null)
  const details = caseDetail.subMerchantForm ?? null
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canEdit = isCaseOwner && isWorking
  const sellerCode = details?.sellerCode?.trim() ?? ''
  const subMerchantName = getStringValue(details?.subMerchantName)
  const businessName = getStringValue(caseDetail.merchant.businessName)
  const website = caseDetail.wordpressWebsite?.clonedWebsiteLink?.trim() ?? ''
  const nokRelation = getNokRelationLabel(caseDetail.merchant.nextOfKinRelation)
  const emailBody = buildEmailBody({
    sellerCode: sellerCode || 'Seller Code not configured',
    subMerchantName: subMerchantName || 'Sub-merchant name not selected',
    businessName: businessName || 'Business name not available',
    website: website || 'WordPress website not submitted',
    nokRelation: nokRelation || 'NOK relation not available',
  })
  const emailAttachments = getEmailAttachments(caseDetail)
  const canSaveProof = Boolean(
    canEdit && details?.finalForm && emailProofFile && !details.emailProof,
  )
  const inheritedSubMerchant = details
    ? {
        key: details.subMerchantKey,
        name: details.subMerchantName,
        draftUrl: details.draftUrl,
      }
    : null

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>EP Sub-Merchant Form</CardTitle>
              <CardDescription>
                Open the inherited sub-merchant draft, then upload the completed
                Final Form.
              </CardDescription>
            </div>
            {details?.emailStatus === 'sent' ? (
              <Badge variant="secondary">
                <MailCheck />
                Proof saved
              </Badge>
            ) : details?.finalForm ? (
              <Badge variant="secondary">
                <CheckCircle2 />
                Ready for Gmail
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Sub-merchant</FieldLabel>
              <ReadonlyValue>
                {inheritedSubMerchant?.name ??
                  'Not selected in document review'}
              </ReadonlyValue>
              <FieldDescription>
                This is inherited from the Document Review case and cannot be
                changed here.
              </FieldDescription>
            </Field>

            {inheritedSubMerchant ? (
              <Field>
                <FieldLabel>Draft form</FieldLabel>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-sm font-medium">
                      {inheritedSubMerchant.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Open the draft and complete it manually before uploading
                      the final file.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <a
                      href={inheritedSubMerchant.draftUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink data-icon="inline-start" />
                      Open draft form
                    </a>
                  </Button>
                </div>
              </Field>
            ) : null}

            <Field data-disabled={!inheritedSubMerchant || !canEdit}>
              <FieldLabel>Final Form</FieldLabel>
              <FinalFormUpload
                disabled={!inheritedSubMerchant || !canEdit}
                isUploading={uploadFinalForm.isPending}
                onUpload={(file) =>
                  inheritedSubMerchant
                    ? uploadFinalForm.mutate({
                        file,
                        subMerchantKey: inheritedSubMerchant.key,
                      })
                    : undefined
                }
              />
              <FieldDescription>
                Upload one completed PDF, DOC, or DOCX file. Maximum size is 1
                MB.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {details?.finalForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Final Form</CardTitle>
            <CardDescription>
              This is the saved form that will be attached to the manual email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
              <FileText className="text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {details.finalForm.originalName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(details.finalForm.sizeBytes)}
                </p>
              </div>
              <Button asChild variant="outline">
                <a
                  href={details.finalForm.googleDriveWebViewLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink data-icon="inline-start" />
                  View final form
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {details?.finalForm ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle>Manual Email Details</CardTitle>
                <CardDescription>
                  Copy this email into Gmail, download the attachments, then
                  upload the sent-mail screenshot below.
                </CardDescription>
              </div>
              {details.emailProof ? (
                <Badge variant="secondary">
                  <MailCheck />
                  Proof saved
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldHeadingAction
                  title="Subject"
                  copyLabel="Copy subject"
                  value={EMAIL_SUBJECT}
                />
                <ReadonlyValue>{EMAIL_SUBJECT}</ReadonlyValue>
              </Field>

              <Field>
                <FieldHeadingAction
                  title="Body"
                  copyLabel="Copy body"
                  value={emailBody}
                />
                <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 px-3 py-3 font-sans text-sm leading-6">
                  {emailBody}
                </pre>
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadEmailDraft(emailBody)}
                >
                  <Download data-icon="inline-start" />
                  Download draft
                </Button>
              </div>

              <Field>
                <FieldLabel>Attachments</FieldLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  {emailAttachments.map((attachment) => (
                    <AttachmentRow
                      key={`${attachment.label}-${attachment.viewUrl}`}
                      attachment={attachment}
                    />
                  ))}
                </div>
                <FieldDescription>
                  Attach these files manually in Gmail before sending.
                </FieldDescription>
              </Field>

              {details.emailProof ? (
                <Field>
                  <FieldLabel>Sent-email screenshot</FieldLabel>
                  <AttachmentRow
                    attachment={toAttachmentLink(
                      'SENT EMAIL SCREENSHOT',
                      details.emailProof,
                    )}
                  />
                </Field>
              ) : (
                <Field data-disabled={!canEdit}>
                  <FieldLabel>Sent-email screenshot</FieldLabel>
                  <EmailProofUpload
                    file={emailProofFile}
                    disabled={!canEdit}
                    isUploading={uploadEmailProof.isPending}
                    onSelect={setEmailProofFile}
                    onClear={() => setEmailProofFile(null)}
                  />
                  <FieldDescription>
                    Upload the Gmail sent-mail screenshot, then save to close
                    this case successfully.
                  </FieldDescription>
                </Field>
              )}
            </FieldGroup>

            {!details.emailProof ? (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  disabled={!canSaveProof || uploadEmailProof.isPending}
                  onClick={async () => {
                    if (!emailProofFile || !canSaveProof) return
                    await uploadEmailProof.mutateAsync({ file: emailProofFile })
                  }}
                >
                  {uploadEmailProof.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Save data-icon="inline-start" />
                  )}
                  {uploadEmailProof.isPending ? 'Saving' : 'Save'}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!inheritedSubMerchant ? (
        <Alert variant="warning">
          <FileText />
          <AlertTitle>Sub-merchant selection required</AlertTitle>
          <AlertDescription>
            Select the sub-merchant in the Document Review case before uploading
            the Final Form.
          </AlertDescription>
        </Alert>
      ) : null}

      {!canEdit && isWorking ? (
        <Alert variant="warning">
          <FileText />
          <AlertTitle>Owner action required</AlertTitle>
          <AlertDescription>
            Only the current case owner can upload the Final Form.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

function ReadonlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
      {children}
    </div>
  )
}

function FieldHeadingAction({
  title,
  copyLabel,
  value,
}: {
  title: string
  copyLabel: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <FieldTitle>{title}</FieldTitle>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copyLabel}
            onClick={() => void navigator.clipboard.writeText(value)}
          >
            <Copy />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copyLabel}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function AttachmentRow({ attachment }: { attachment: AttachmentLink }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/30 px-3 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <FileText className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="wrap-break-word text-sm font-medium">
            {attachment.label}
          </p>
          <p className="wrap-break-word text-xs text-muted-foreground">
            {attachment.name}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">
        <Button asChild variant="outline" size="sm">
          <a href={attachment.viewUrl} target="_blank" rel="noreferrer">
            <ExternalLink data-icon="inline-start" />
            View
          </a>
        </Button>
        {attachment.downloadUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={attachment.downloadUrl} target="_blank" rel="noreferrer">
              <Download data-icon="inline-start" />
              Download
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function EmailProofUpload({
  file,
  disabled,
  isUploading,
  onSelect,
  onClear,
}: {
  file: File | null
  disabled: boolean
  isUploading: boolean
  onSelect: (file: File) => void
  onClear: () => void
}) {
  const inputId = useId()
  const labelId = useId()
  const descriptionId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(nextFile: File | undefined) {
    if (!nextFile || disabled || isUploading) return

    const validationError = validateEmailProof(nextFile)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    onSelect(nextFile)
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
          'relative flex min-h-32 select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 outline-none transition-colors hover:bg-accent/30 focus-visible:border-ring/50 data-disabled:pointer-events-none data-disabled:opacity-60 data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20',
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
        {file ? (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-md border bg-muted p-2">
                <Image className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isUploading}
              onClick={onClear}
            >
              Clear
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full border-2 border-dashed border-muted-foreground/25 p-3">
              {isUploading ? (
                <Spinner className="size-6 text-muted-foreground" />
              ) : (
                <Image className="size-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">Drop screenshot here</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WEBP (max 10 MB)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload data-icon="inline-start" />
              Browse files
            </Button>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        accept={ACCEPTED_EMAIL_PROOF_EXTENSIONS.join(',')}
        className="sr-only"
        type="file"
        disabled={disabled || isUploading}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <div id={labelId} className="sr-only">
        Email screenshot upload
      </div>
      <FieldError>{error}</FieldError>
    </div>
  )
}

function FinalFormUpload({
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

    const validationError = validateFinalForm(file)
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
              {isUploading ? 'Uploading Final Form' : 'Drop final form here'}
            </p>
            <p className="text-sm text-muted-foreground">
              PDF, DOC, DOCX (max 1MB)
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
        accept={ACCEPTED_FINAL_FORM_EXTENSIONS.join(',')}
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
