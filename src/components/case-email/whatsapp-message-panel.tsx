import { useMemo, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import type { EmailPreviewResult } from '#/apis/cases'

interface WhatsAppMessagePanelProps {
  preview: EmailPreviewResult
  phoneNumber: string | null | undefined
  onConfirm: (file: File) => void
  isPending: boolean
}

export function WhatsAppMessagePanel({
  preview,
  phoneNumber,
  onConfirm,
  isPending,
}: WhatsAppMessagePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [copied, setCopied] = useState(false)
  const whatsappUrl = useMemo(
    () => buildWhatsappUrl(phoneNumber, preview.body),
    [phoneNumber, preview.body],
  )

  function copyMessage() {
    navigator.clipboard.writeText(preview.body).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      toast.success('WhatsApp message copied')
    })
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  function handleConfirm() {
    if (!selectedFile) {
      toast.error('Please attach a screenshot of the sent WhatsApp message.')
      return
    }
    onConfirm(selectedFile)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">WhatsApp:</span>{' '}
        {phoneNumber || 'No active WhatsApp number on file'}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" asChild disabled={!whatsappUrl}>
          <a
            href={whatsappUrl || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!whatsappUrl}
          >
            <ExternalLink data-icon="inline-start" />
            Open WhatsApp
          </a>
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Message
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-xs"
            onClick={copyMessage}
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="max-h-64 select-all overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 font-sans text-sm leading-relaxed">
          {preview.body}
        </pre>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Screenshot proof
        </p>
        <p className="text-xs text-muted-foreground">
          After sending the WhatsApp message, attach the sent-message
          screenshot.
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
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
            {selectedFile ? 'Change file' : 'Attach screenshot'}
          </Button>
          {selectedFile ? (
            <span className="max-w-48 truncate text-sm text-muted-foreground">
              {selectedFile.name}
            </span>
          ) : null}
        </div>
      </div>

      <Button disabled={!selectedFile || isPending} onClick={handleConfirm}>
        {isPending ? 'Saving...' : 'Save WhatsApp screenshot'}
      </Button>
    </div>
  )
}

function buildWhatsappUrl(
  phoneNumber: string | null | undefined,
  message: string,
) {
  const normalized = normalizePakistaniWhatsappNumber(phoneNumber)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

function normalizePakistaniWhatsappNumber(
  phoneNumber: string | null | undefined,
) {
  const digits = phoneNumber?.replace(/\D/g, '') ?? ''
  if (/^03\d{9}$/.test(digits)) return `92${digits.slice(1)}`
  if (/^923\d{9}$/.test(digits)) return digits
  return null
}
