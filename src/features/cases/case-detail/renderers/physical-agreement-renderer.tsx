import { useId, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, FileText, Info, Upload } from 'lucide-react'

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
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { useUploadPhysicalAgreementCopy } from '#/hooks/use-case-detail-query'

import type { QueueRendererProps } from '../queue-registry'

const MAX_PHYSICAL_AGREEMENT_BYTES = 10 * 1024 * 1024
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(fileName: string) {
  return fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
}

function validatePhysicalAgreement(file: File) {
  if (file.size > MAX_PHYSICAL_AGREEMENT_BYTES) {
    return `File must be 10 MB or smaller. Selected file is ${formatFileSize(file.size)}.`
  }

  if (
    !ACCEPTED_EXTENSIONS.includes(
      getFileExtension(file.name) as (typeof ACCEPTED_EXTENSIONS)[number],
    ) ||
    !ACCEPTED_MIME_TYPES.has(file.type)
  ) {
    return 'Upload a PDF, JPG, PNG, or WebP file.'
  }

  return null
}

export default function PhysicalAgreementRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uploadCopy = useUploadPhysicalAgreementCopy(caseId)
  const [error, setError] = useState<string | null>(null)
  const uploadedFile = caseDetail.physicalAgreement ?? null
  const isClosed = caseDetail.case.status === 'closed'
  const canUpload = caseDetail.case.status === 'working' && !isClosed

  function handleFile(file: File | undefined) {
    if (!file || !canUpload || uploadCopy.isPending) return

    const validationError = validatePhysicalAgreement(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    uploadCopy.mutate(file, {
      onSuccess: () => {
        if (inputRef.current) inputRef.current.value = ''
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Physical Agreement</CardTitle>
              <CardDescription>
                Upload the scanned signed agreement received from the client,
                then close this case successfully.
              </CardDescription>
            </div>
            <Badge variant={uploadedFile ? 'secondary' : 'outline'}>
              {uploadedFile ? <CheckCircle2 /> : <FileText />}
              {uploadedFile ? 'Uploaded' : 'Required'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Alert>
              <Info />
              <AlertTitle>Go-Live requirement</AlertTitle>
              <AlertDescription>
                Go-Live will remain blocked until this physical agreement case
                is closed successfully.
              </AlertDescription>
            </Alert>

            {uploadedFile ? (
              <Field>
                <FieldLabel>Uploaded copy</FieldLabel>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
                  <FileText className="text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {uploadedFile.originalName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(uploadedFile.sizeBytes)}
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <a
                      href={uploadedFile.googleDriveWebViewLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink data-icon="inline-start" />
                      View copy
                    </a>
                  </Button>
                </div>
              </Field>
            ) : null}

            <Field data-invalid={Boolean(error)} data-disabled={!canUpload}>
              <FieldLabel htmlFor={inputId}>Scanned signed agreement</FieldLabel>
              <Input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={!canUpload || uploadCopy.isPending}
                aria-invalid={Boolean(error)}
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <FieldDescription>
                PDF, JPG, PNG, or WebP. Maximum size 10 MB.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>

            {uploadCopy.isPending ? (
              <Button disabled variant="outline">
                <Spinner data-icon="inline-start" />
                Uploading copy
              </Button>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}