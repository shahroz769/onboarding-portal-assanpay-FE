import { useRef, useState } from 'react'
import { Copy, Check, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { TruncatedTooltip } from '#/components/truncated-tooltip'
import { Button } from '#/components/ui/button'
import type { AgreementEmailPreviewResult } from '#/apis/cases'

interface ManualEmailPanelProps {
  preview: AgreementEmailPreviewResult
  onConfirm: (file: File) => void
  isPending: boolean
}

export function ManualEmailPanel({
  preview,
  onConfirm,
  isPending,
}: ManualEmailPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [copiedSubject, setCopiedSubject] = useState(false)
  const [copiedBody, setCopiedBody] = useState(false)

  function copyToClipboard(text: string, type: 'subject' | 'body') {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'subject') {
        setCopiedSubject(true)
        setTimeout(() => setCopiedSubject(false), 2000)
      } else {
        setCopiedBody(true)
        setTimeout(() => setCopiedBody(false), 2000)
      }
      toast.success(
        `${type === 'subject' ? 'Subject' : 'Body'} copied to clipboard`,
      )
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  function handleConfirm() {
    if (!selectedFile) {
      toast.error('Please attach a screenshot of the sent email.')
      return
    }
    onConfirm(selectedFile)
  }

  return (
    <div className="space-y-4">
      {/* CC / BCC / reply-to come from Configuration → Email sending, so a
          Gmail send reaches the same people as the automatic one. */}
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <RecipientLine label="To" emails={[preview.recipient]} />
        <RecipientLine label="Cc" emails={preview.cc} />
        <RecipientLine label="Bcc" emails={preview.bcc} />
        <RecipientLine label="Reply-to" emails={preview.replyTo} />
      </div>

      {/* Subject */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Subject
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => copyToClipboard(preview.subject, 'subject')}
          >
            {copiedSubject ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            {copiedSubject ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm select-all">
          {preview.subject}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Body
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => copyToClipboard(preview.body, 'body')}
          >
            {copiedBody ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            {copiedBody ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-sm font-sans leading-relaxed max-h-64 overflow-y-auto scrollbar-thin select-all">
          {preview.body}
        </pre>
      </div>

      {/* Screenshot upload */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Screenshot proof
        </p>
        <p className="text-xs text-muted-foreground">
          After sending the email in Gmail, attach a screenshot of the sent
          email. This is required to advance the case.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <Upload className="size-3.5" />
            {selectedFile ? 'Change file' : 'Attach screenshot'}
          </Button>
          {selectedFile ? (
            <TruncatedTooltip
              render={
                <span className="max-w-48 truncate text-sm text-muted-foreground" />
              }
              content={selectedFile.name}
            >
              {selectedFile.name}
            </TruncatedTooltip>
          ) : null}
        </div>
      </div>

      <Button
        disabled={!selectedFile || isPending}
        onClick={handleConfirm}
        className="w-full"
      >
        {isPending ? 'Saving…' : 'Mark as sent & save screenshot'}
      </Button>
    </div>
  )
}

/** One recipient row; lists get a copy button to paste into Gmail. */
function RecipientLine({
  label,
  emails,
}: {
  label: string
  emails?: string[]
}) {
  if (!emails || emails.length === 0) return null
  const value = emails.join(', ')
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <span className="shrink-0 font-medium text-foreground">{label}:</span>
      <span className="min-w-0 flex-1 wrap-anywhere select-all">{value}</span>
      {label !== 'To' ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1 px-2 text-xs"
          onClick={() =>
            void navigator.clipboard
              .writeText(value)
              .then(() => toast.success(`${label} copied to clipboard`))
          }
        >
          <Copy className="size-3" />
          Copy
        </Button>
      ) : null}
    </div>
  )
}
