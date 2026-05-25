import { useRef, useState } from 'react'
import { Copy, Check, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import type { EmailPreviewResult } from '#/apis/cases'

interface ManualEmailPanelProps {
  preview: EmailPreviewResult
  onConfirm: (file: File) => void
  isPending: boolean
}

export function ManualEmailPanel({ preview, onConfirm, isPending }: ManualEmailPanelProps) {
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
      toast.success(`${type === 'subject' ? 'Subject' : 'Body'} copied to clipboard`)
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
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">To:</span> {preview.recipient}
      </div>

      {/* Subject */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => copyToClipboard(preview.subject, 'subject')}
          >
            {copiedSubject ? <Check className="size-3" /> : <Copy className="size-3" />}
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Body</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => copyToClipboard(preview.body, 'body')}
          >
            {copiedBody ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copiedBody ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-sm font-sans leading-relaxed max-h-64 overflow-y-auto select-all">
          {preview.body}
        </pre>
      </div>

      {/* Screenshot upload */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Screenshot proof
        </p>
        <p className="text-xs text-muted-foreground">
          After sending the email in Gmail, attach a screenshot of the sent email. This is required to advance the case.
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
            <span className="text-sm text-muted-foreground truncate max-w-48">{selectedFile.name}</span>
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
