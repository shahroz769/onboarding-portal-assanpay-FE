import { useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  Upload,
  X,
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
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { useUploadPhysicalAgreementCopy } from '#/hooks/use-case-detail-query'
import { cn } from '#/lib/utils'

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const uploadedFile = caseDetail.physicalAgreement ?? null
  const isClosed = caseDetail.case.status === 'closed'
  const canUpload = caseDetail.case.status === 'working' && !isClosed

  function handleFileSelected(file: File | undefined) {
    if (!file || !canUpload || uploadCopy.isPending) return

    const validationError = validatePhysicalAgreement(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSelectedFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleUpload() {
    if (!selectedFile || !canUpload || uploadCopy.isPending) return

    uploadCopy.mutate(selectedFile, {
      onSuccess: () => {
        setSelectedFile(null)
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
            <Alert variant="warning">
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
              <FieldLabel>Scanned signed agreement</FieldLabel>
              <PhysicalAgreementUpload
                inputId={inputId}
                inputRef={inputRef}
                file={selectedFile}
                error={error}
                disabled={!canUpload}
                isUploading={uploadCopy.isPending}
                onSelect={handleFileSelected}
                onClear={() => {
                  setSelectedFile(null)
                  setError(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              />
              <FieldDescription>
                PDF, JPG, PNG, or WebP. Maximum size 10 MB.
              </FieldDescription>
            </Field>

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!canUpload || !selectedFile || uploadCopy.isPending}
                onClick={handleUpload}
              >
                {uploadCopy.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Upload data-icon="inline-start" />
                )}
                {uploadCopy.isPending ? 'Uploading' : 'Upload copy'}
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}

function PhysicalAgreementUpload({
  inputId,
  inputRef,
  file,
  error,
  disabled,
  isUploading,
  onSelect,
  onClear,
}: {
  inputId: string
  inputRef: RefObject<HTMLInputElement | null>
  file: File | null
  error: string | null
  disabled: boolean
  isUploading: boolean
  onSelect: (file: File | undefined) => void
  onClear: () => void
}) {
  const labelId = useId()
  const descriptionId = useId()
  const [isDragging, setIsDragging] = useState(false)

  function handleFile(fileList: FileList | null) {
    if (!fileList || disabled || isUploading) return
    onSelect(fileList[0])
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
          handleFile(event.dataTransfer.files)
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
                <FileText className="size-5 text-muted-foreground" />
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
              size="icon"
              disabled={disabled || isUploading}
              onClick={onClear}
            >
              <X />
              <span className="sr-only">Clear selected file</span>
            </Button>
          </div>
        ) : (
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
                {isUploading
                  ? 'Uploading scanned agreement'
                  : 'Drop scanned agreement here'}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF, JPG, PNG, WEBP (max 10 MB)
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
              Browse files
            </Button>
          </div>
        )}
      </div>
      <Input
        ref={inputRef}
        id={inputId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled || isUploading}
        aria-invalid={Boolean(error)}
        onChange={(event) => handleFile(event.target.files)}
      />
      <div id={labelId} className="sr-only">
        Scanned signed agreement upload
      </div>
      <FieldError>{error}</FieldError>
    </div>
  )
}
