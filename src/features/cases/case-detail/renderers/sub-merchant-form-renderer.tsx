import { useEffect, useId, useRef, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  MailCheck,
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
} from '#/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Spinner } from '#/components/ui/spinner'
import { useAuth } from '#/features/auth/auth-client'
import { useUploadSubMerchantFinalForm } from '#/hooks/use-case-detail-query'
import { cn } from '#/lib/utils'

import type { QueueRendererProps } from '../queue-registry'

const MAX_FINAL_FORM_BYTES = 1024 * 1024
const ACCEPTED_FINAL_FORM_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const
const ACCEPTED_FINAL_FORM_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const SUB_MERCHANT_OPTIONS = [
  {
    key: 'devtects',
    name: 'Devtects',
    draftUrl:
      'https://drive.google.com/open?id=1TAS9wWcEfXISRdTVuPhjUZs2gVM5sd27&usp=drive_copy',
  },
  {
    key: 'digifytive',
    name: 'Digifytive',
    draftUrl:
      'https://drive.google.com/open?id=1JTYSHQHg4iz8DYK9FDG2z2o_iWzCiYTr&usp=drive_copy',
  },
  {
    key: 'evolvica-solutions',
    name: 'Evolvica Solutions',
    draftUrl:
      'https://drive.google.com/open?id=1pYrQY4uWYCwPugCCNxRTWWAXI8V_gr21&usp=drive_copy',
  },
  {
    key: 'monic-tech',
    name: 'Monic Tech',
    draftUrl:
      'https://drive.google.com/open?id=1HpgKBmrEmcTQIhji5vkhiRHU8LrlK0lU&usp=drive_copy',
  },
] as const

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
      getFileExtension(file.name) as (typeof ACCEPTED_FINAL_FORM_EXTENSIONS)[number],
    ) ||
    !ACCEPTED_FINAL_FORM_TYPES.has(file.type)
  ) {
    return 'Final Form must be a PDF, DOC, or DOCX file.'
  }

  return null
}

export default function SubMerchantFormRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const uploadFinalForm = useUploadSubMerchantFinalForm(caseId)
  const details = caseDetail.subMerchantForm ?? null
  const [selectedSubMerchantKey, setSelectedSubMerchantKey] = useState(
    details?.subMerchantKey ?? '',
  )
  const isCaseOwner = Boolean(caseDetail.owner && user?.id === caseDetail.owner.id)
  const isWorking = caseDetail.case.status === 'working'
  const canEdit = isCaseOwner && isWorking
  const selectedOption =
    SUB_MERCHANT_OPTIONS.find((option) => option.key === selectedSubMerchantKey) ??
    null

  useEffect(() => {
    setSelectedSubMerchantKey(details?.subMerchantKey ?? '')
  }, [details?.subMerchantKey])

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>EP Sub-Merchant Form</CardTitle>
              <CardDescription>
                Select the sub-merchant, open the draft, then upload the completed Final Form.
              </CardDescription>
            </div>
            {details?.emailStatus === 'sent' ? (
              <Badge variant="secondary">
                <MailCheck />
                Email sent
              </Badge>
            ) : details?.finalForm ? (
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
              <FieldLabel htmlFor="sub-merchant">Sub-merchant</FieldLabel>
              <Select
                value={selectedSubMerchantKey}
                onValueChange={setSelectedSubMerchantKey}
                disabled={!canEdit || uploadFinalForm.isPending}
              >
                <SelectTrigger id="sub-merchant" className="w-full">
                  <SelectValue placeholder="Select sub-merchant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SUB_MERCHANT_OPTIONS.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                The draft form becomes available after a sub-merchant is selected.
              </FieldDescription>
            </Field>

            {selectedOption ? (
              <Field>
                <FieldLabel>Draft form</FieldLabel>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-sm font-medium">
                      {selectedOption.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Open the draft and complete it manually before uploading the final file.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <a
                      href={selectedOption.draftUrl}
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

            <Field data-disabled={!selectedOption || !canEdit}>
              <FieldLabel>Final Form</FieldLabel>
              <FinalFormUpload
                disabled={!selectedOption || !canEdit}
                isUploading={uploadFinalForm.isPending}
                onUpload={(file) =>
                  selectedOption
                    ? uploadFinalForm.mutate({
                        file,
                        subMerchantKey: selectedOption.key,
                      })
                    : undefined
                }
              />
              <FieldDescription>
                Upload one completed PDF, DOC, or DOCX file. Maximum size is 1 MB.
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
              This is the saved form that will be included in the review email.
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

      {!canEdit && isWorking ? (
        <Alert>
          <FileText />
          <AlertTitle>Owner action required</AlertTitle>
          <AlertDescription>
            Only the current case owner can select the sub-merchant and upload the Final Form.
          </AlertDescription>
        </Alert>
      ) : null}
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
    <div data-slot="file-upload" dir="ltr" className="relative flex w-full flex-col gap-2">
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
