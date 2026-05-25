import { useId, useRef, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  FileImage,
  Globe,
  Info,
  LinkIcon,
  Upload,
  X,
} from 'lucide-react'
import { z } from 'zod'

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
import { useAuth } from '#/features/auth/auth-client'
import { useSaveWordpressWebsiteCase } from '#/hooks/use-case-detail-query'
import { cn } from '#/lib/utils'

import type { QueueRendererProps } from '../queue-registry'

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024
const SCREENSHOT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const formSchema = z.object({
  clonedWebsiteLink: z
    .string()
    .trim()
    .min(1, 'WordPress website link is required.')
    .url('Enter a valid URL.'),
})

function getMerchantString(
  merchant: Record<string, unknown>,
  key: string,
): string | null {
  const value = merchant[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateScreenshot(file: File) {
  if (!SCREENSHOT_TYPES.has(file.type)) {
    return 'Screenshots must be JPG, PNG, or WEBP files.'
  }

  if (file.size > MAX_SCREENSHOT_BYTES) {
    return 'Each screenshot must be 10 MB or smaller.'
  }

  return null
}

function getValidScreenshots(files: File[]) {
  const nextFiles: File[] = []

  for (const file of files) {
    const error = validateScreenshot(file)
    if (error) return { files: [], error }
    nextFiles.push(file)
  }

  return { files: nextFiles, error: null }
}

export default function WordpressWebsiteRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const saveWebsite = useSaveWordpressWebsiteCase(caseId)
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canEdit = isCaseOwner && isWorking
  const businessWebsite = getMerchantString(
    caseDetail.merchant,
    'businessWebsite',
  )
  const wordpressWebsite = caseDetail.wordpressWebsite ?? null
  const savedLink = wordpressWebsite?.clonedWebsiteLink ?? null
  const savedScreenshots = wordpressWebsite?.screenshots ?? []
  const savedLogoScreenshots =
    wordpressWebsite?.subMerchantLogoScreenshots ?? []
  const documentReviewSubMerchantName =
    caseDetail.documentReview?.subMerchantName ?? null
  const isComplete = Boolean(
    savedLink && savedScreenshots.length > 0 && savedLogoScreenshots.length > 0,
  )

  const [clonedWebsiteLink, setClonedWebsiteLink] = useState(savedLink ?? '')
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [subMerchantLogoScreenshots, setSubMerchantLogoScreenshots] = useState<
    File[]
  >([])
  const [linkError, setLinkError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [logoFileError, setLogoFileError] = useState<string | null>(null)

  function handleFilesSelected(files: File[]) {
    const result = getValidScreenshots(files)
    if (result.error) {
      setFileError(result.error)
      return
    }

    setScreenshots((current) => [...current, ...result.files].slice(0, 30))
    setFileError(null)
  }

  function handleLogoFilesSelected(files: File[]) {
    const result = getValidScreenshots(files)
    if (result.error) {
      setLogoFileError(result.error)
      return
    }

    setSubMerchantLogoScreenshots((current) =>
      [...current, ...result.files].slice(0, 30),
    )
    setLogoFileError(null)
  }

  async function handleSave() {
    const result = formSchema.safeParse({ clonedWebsiteLink })
    if (!result.success) {
      setLinkError(result.error.issues[0]?.message ?? 'Invalid link.')
      return
    }

    if (screenshots.length === 0) {
      setFileError('Upload screenshots of all pages before saving.')
      return
    }

    if (subMerchantLogoScreenshots.length === 0) {
      setLogoFileError(
        'Upload a screenshot of the sub-merchant website with the merchant logo before saving.',
      )
      return
    }

    setLinkError(null)
    setFileError(null)
    setLogoFileError(null)
    await saveWebsite.mutateAsync({
      clonedWebsiteLink: result.data.clonedWebsiteLink,
      screenshots,
      subMerchantLogoScreenshots,
    })
    setScreenshots([])
    setSubMerchantLogoScreenshots([])
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>WordPress Website</CardTitle>
              <CardDescription>
                Review the submitted business website, then save the cloned
                WordPress link and screenshots.
              </CardDescription>
            </div>
            <Badge variant={isComplete ? 'secondary' : 'outline'}>
              {isComplete ? <CheckCircle2 /> : <Globe />}
              {isComplete ? 'Ready to close' : 'Pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Business Website</FieldLabel>
              <ReadonlyValue>
                {businessWebsite ? (
                  <a
                    href={businessWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-2 text-primary underline-offset-2 hover:underline"
                  >
                    <span className="wrap-break-word">{businessWebsite}</span>
                    <ExternalLink className="size-4 shrink-0" />
                  </a>
                ) : (
                  'Not provided'
                )}
              </ReadonlyValue>
            </Field>

            <Field>
              <FieldLabel>Sub-merchant name</FieldLabel>
              <ReadonlyValue>
                {documentReviewSubMerchantName ?? 'Not selected'}
              </ReadonlyValue>
              <FieldDescription>
                Selected internally during document review.
              </FieldDescription>
            </Field>

            <Field data-invalid={Boolean(linkError)}>
              <FieldLabel htmlFor="wordpress-cloned-link">
                WordPress Website Link (Cloned)
              </FieldLabel>
              <Input
                id="wordpress-cloned-link"
                type="url"
                placeholder="https://example.com"
                value={clonedWebsiteLink}
                disabled={!canEdit || saveWebsite.isPending}
                aria-invalid={Boolean(linkError)}
                onChange={(event) => {
                  setClonedWebsiteLink(event.target.value)
                  if (linkError) setLinkError(null)
                }}
              />
              <FieldDescription>
                This is the cloned WordPress website URL that will be stored on
                the case.
              </FieldDescription>
              <FieldError>{linkError}</FieldError>
            </Field>

            <Field data-invalid={Boolean(fileError)}>
              <FieldLabel>Screenshots of all pages</FieldLabel>
              <ScreenshotUpload
                disabled={!canEdit}
                isUploading={saveWebsite.isPending}
                files={screenshots}
                error={fileError}
                onError={setFileError}
                onFilesSelected={handleFilesSelected}
                onRemove={(index) =>
                  setScreenshots((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              />
              <FieldDescription>
                JPG, PNG, or WEBP. Upload up to 30 screenshots.
              </FieldDescription>
            </Field>

            <Field data-invalid={Boolean(logoFileError)}>
              <FieldLabel>Sub-merchant website logo screenshot</FieldLabel>
              <ScreenshotUpload
                disabled={!canEdit}
                isUploading={saveWebsite.isPending}
                files={subMerchantLogoScreenshots}
                error={logoFileError}
                onError={setLogoFileError}
                onFilesSelected={handleLogoFilesSelected}
                onRemove={(index) =>
                  setSubMerchantLogoScreenshots((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              />
              <FieldDescription>
                Upload the screenshot showing the sub-merchant website with the
                merchant logo added.
              </FieldDescription>
            </Field>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!canEdit || saveWebsite.isPending}
              >
                {saveWebsite.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <LinkIcon data-icon="inline-start" />
                )}
                {saveWebsite.isPending ? 'Saving' : 'Save website details'}
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {savedLink ||
      savedScreenshots.length > 0 ||
      savedLogoScreenshots.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved Evidence</CardTitle>
            <CardDescription>
              Current cloned website link and screenshots attached to this case.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {savedLink ? (
              <ReadonlyValue>
                <a
                  href={savedLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-2 text-primary underline-offset-2 hover:underline"
                >
                  <span className="wrap-break-word">{savedLink}</span>
                  <ExternalLink className="size-4 shrink-0" />
                </a>
              </ReadonlyValue>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              {savedScreenshots.map((screenshot) => (
                <a
                  key={screenshot.id}
                  href={screenshot.googleDriveWebViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 hover:bg-muted/40"
                >
                  <FileImage className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {screenshot.originalName}
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>

            {savedLogoScreenshots.length > 0 ? (
              <div className="flex flex-col gap-2">
                <FieldLabel>Sub-merchant website logo screenshot</FieldLabel>
                <div className="grid gap-3 md:grid-cols-2">
                  {savedLogoScreenshots.map((screenshot) => (
                    <a
                      key={screenshot.id}
                      href={screenshot.googleDriveWebViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 hover:bg-muted/40"
                    >
                      <FileImage className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {screenshot.originalName}
                      </span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!canEdit && isWorking ? (
        <Alert>
          <Info />
          <AlertTitle>Owner action required</AlertTitle>
          <AlertDescription>
            Only the current case owner can save the cloned website link and
            screenshots.
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

function ScreenshotUpload({
  disabled,
  isUploading,
  files,
  error,
  onError,
  onFilesSelected,
  onRemove,
}: {
  disabled: boolean
  isUploading: boolean
  files: File[]
  error: string | null
  onError: (error: string | null) => void
  onFilesSelected: (files: File[]) => void
  onRemove: (index: number) => void
}) {
  const inputId = useId()
  const labelId = useId()
  const descriptionId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || disabled || isUploading) return
    const selectedFiles = Array.from(fileList)
    if (selectedFiles.length === 0) return

    onFilesSelected(selectedFiles)
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
          handleFiles(event.dataTransfer.files)
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
              <FileImage className="size-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-semibold">
              {isUploading ? 'Saving screenshots' : 'Drop screenshots here'}
            </p>
            <p className="text-sm text-muted-foreground">
              JPG, PNG, WEBP (max 10MB each)
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
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
              Browse Screenshots
            </Button>
            {files.length > 0 ? (
              <Badge variant="secondary">{files.length} selected</Badge>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        type="file"
        multiple
        disabled={disabled || isUploading}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div id={labelId} className="sr-only">
        Screenshot upload
      </div>
      <FieldError>{error}</FieldError>
      {files.length > 0 ? (
        <div className="flex flex-col gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2"
            >
              <FileImage className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isUploading}
                onClick={() => {
                  onRemove(index)
                  onError(null)
                }}
              >
                <X />
                <span className="sr-only">Remove screenshot</span>
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
