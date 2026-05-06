import { useRef, useState } from 'react'
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

export default function WordpressWebsiteRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const inputRef = useRef<HTMLInputElement>(null)
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
  const isComplete = Boolean(savedLink && savedScreenshots.length > 0)

  const [clonedWebsiteLink, setClonedWebsiteLink] = useState(savedLink ?? '')
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [linkError, setLinkError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0) return

    const nextFiles: File[] = []
    for (const file of files) {
      const error = validateScreenshot(file)
      if (error) {
        setFileError(error)
        return
      }
      nextFiles.push(file)
    }

    setScreenshots((current) => [...current, ...nextFiles].slice(0, 30))
    setFileError(null)
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

    setLinkError(null)
    setFileError(null)
    await saveWebsite.mutateAsync({
      clonedWebsiteLink: result.data.clonedWebsiteLink,
      screenshots,
    })
    setScreenshots([])
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
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canEdit || saveWebsite.isPending}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload data-icon="inline-start" />
                  Upload screenshots
                </Button>
                {screenshots.length > 0 ? (
                  <Badge variant="secondary">
                    {screenshots.length} selected
                  </Badge>
                ) : null}
              </div>
              <FieldDescription>
                JPG, PNG, or WEBP. Upload up to 30 screenshots.
              </FieldDescription>
              <FieldError>{fileError}</FieldError>
            </Field>

            {screenshots.length > 0 ? (
              <div className="flex flex-col gap-2">
                {screenshots.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    <FileImage className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={saveWebsite.isPending}
                      onClick={() =>
                        setScreenshots((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <X />
                      <span className="sr-only">Remove screenshot</span>
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

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

      {savedLink || savedScreenshots.length > 0 ? (
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
