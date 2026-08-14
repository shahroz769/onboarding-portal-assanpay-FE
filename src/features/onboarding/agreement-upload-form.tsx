import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { format } from 'date-fns'
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import type { AgreementUploadContext } from '#/apis/merchant-onboarding'
import { useSubmitAgreementUploadMutation } from '#/apis/merchant-onboarding'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
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
import { Spinner } from '#/components/ui/spinner'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { formatExpiryLabel, NO_EXPIRY_LABEL } from '#/lib/expiry'
import { cn } from '#/lib/utils'

interface AgreementUploadFormProps {
  token: string
  context: AgreementUploadContext
}

const MAX_AGREEMENT_BYTES = 1024 * 1024
const ACCEPTED_AGREEMENT_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const
const ACCEPTED_AGREEMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateAgreement(file: File) {
  if (file.size > MAX_AGREEMENT_BYTES) {
    return `Agreement must be 1 MB or smaller. Selected file is ${formatFileSize(file.size)}.`
  }

  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  if (
    !ACCEPTED_AGREEMENT_EXTENSIONS.includes(
      extension as (typeof ACCEPTED_AGREEMENT_EXTENSIONS)[number],
    ) ||
    !ACCEPTED_AGREEMENT_TYPES.has(file.type)
  ) {
    return 'Agreement must be a PDF, DOC, or DOCX file.'
  }

  return null
}

export function AgreementUploadForm({
  token,
  context,
}: AgreementUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const mutation = useSubmitAgreementUploadMutation(token)

  const expiresLabel = formatExpiryLabel(context.expiresAt, (date) =>
    format(date, 'PPP'),
  )

  function handleFileChange(nextFile: File | null) {
    if (!nextFile) {
      setFile(null)
      return
    }

    const validationError = validateAgreement(nextFile)
    if (validationError) {
      setError(validationError)
      setFile(null)
      return
    }

    setError(null)
    setFile(nextFile)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!file) {
      setError('Signed agreement file is required.')
      return
    }

    mutation.mutate(file, {
      onSuccess: () => {
        setSubmitted(true)
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err, 'Unable to submit agreement.'))
      },
    })
  }

  if (submitted) {
    return (
      <Card className="motion-success-enter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="motion-success-icon flex">
              <CheckCircle2 className="size-5 text-green-600" />
            </span>
            Agreement submitted
          </CardTitle>
          <CardDescription>
            Thank you. Your signed agreement has been returned to our team for
            review. You can close this window.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Agreement</h1>
        <p className="mt-2 text-muted-foreground">
          Review and upload the signed agreement for {context.merchantName}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit signed agreement</CardTitle>
          <CardDescription>
            {expiresLabel
              ? expiresLabel === NO_EXPIRY_LABEL
                ? `${NO_EXPIRY_LABEL}.`
                : `This secure link expires ${expiresLabel}.`
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <Info />
            <AlertTitle>Agreement file</AlertTitle>
            <AlertDescription>
              Download or open the agreement, sign it, then upload one PDF, DOC,
              or DOCX file.
            </AlertDescription>
          </Alert>

          {context.remarks ? (
            <Alert variant="destructive">
              <Info />
              <AlertTitle>Reviewer remarks</AlertTitle>
              <AlertDescription>{context.remarks}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
            <FileText className="text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {context.finalAgreementName}
              </p>
              <p className="text-sm text-muted-foreground">
                Open the agreement from Google Drive.
              </p>
            </div>
            <Button asChild variant="outline">
              <a
                href={context.finalAgreementUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink data-icon="inline-start" />
                Open agreement
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload signed agreement</CardTitle>
          <CardDescription>
            Accepted formats: PDF, DOC, DOCX. Maximum file size is 1 MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel>Signed Agreement</FieldLabel>
              <AgreementUploadField
                file={file}
                error={error}
                disabled={mutation.isPending}
                onFileChange={handleFileChange}
              />
              <FieldDescription>
                Upload the signed copy containing all required pages.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <CheckCircle2 data-icon="inline-start" />
          )}
          {mutation.isPending ? 'Submitting...' : 'Submit agreement'}
        </Button>
      </div>
    </form>
  )
}

function AgreementUploadField({
  file,
  error,
  disabled,
  onFileChange,
}: {
  file: File | null
  error: string | null
  disabled: boolean
  onFileChange: (file: File | null) => void
}) {
  const inputId = useId()
  const labelId = useId()
  const descriptionId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFile(nextFile: File | undefined) {
    if (!nextFile || disabled) return
    onFileChange(nextFile)
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
        aria-disabled={disabled}
        aria-invalid={Boolean(error)}
        data-slot="file-upload-dropzone"
        data-disabled={disabled ? true : undefined}
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
            <FileText className="size-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">
              {file ? file.name : 'Drop signed agreement here'}
            </p>
            <p className="text-sm text-muted-foreground">
              {file ? formatFileSize(file.size) : 'PDF, DOC, DOCX (max 1MB)'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
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
        disabled={disabled}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <div id={labelId} className="sr-only">
        Signed agreement upload
      </div>
      <FieldError>{error}</FieldError>
    </div>
  )
}
