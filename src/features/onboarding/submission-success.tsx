import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export type SubmissionSummary = {
  reference: string
  merchantNumber: number | null
  businessName: string
  submittedAt: string
  // Unknown when the summary was restored from this device.
  documentCount: number | null
}

type SubmissionSuccessProps = {
  summary: SubmissionSummary
  // True when the page reopened after an earlier submission on this device.
  isReturning: boolean
  onNewSubmission: () => void
}

function formatSubmittedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : format(date, 'd MMM yyyy')
}

export function SubmissionSuccess({
  summary,
  isReturning,
  onNewSubmission,
}: SubmissionSuccessProps) {
  // This view replaces the form (and the page heading), so the focused submit
  // button is gone; land focus on the new heading instead of <body>.
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const submittedOn = formatSubmittedAt(summary.submittedAt)

  return (
    <div className="motion-success-enter flex flex-col items-center gap-6 py-12">
      <div className="motion-success-icon flex size-20 items-center justify-center rounded-full bg-muted">
        <CheckCircle2 aria-hidden="true" className="size-10 text-foreground" />
      </div>

      <div className="max-w-md text-center">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none"
        >
          {isReturning
            ? 'You have already applied'
            : 'Form Submitted Successfully'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isReturning
            ? `We received your application for ${summary.businessName}${submittedOn ? ` on ${submittedOn}` : ''}.`
            : 'Your merchant onboarding form has been received and is being processed.'}{' '}
          Our team will contact you, so you do not need to submit it again.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h2>Submission Details</h2>
          </CardTitle>
          <CardDescription>
            Keep this information for your records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3 text-sm">
            {summary.merchantNumber !== null ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Application No.</dt>
                <dd className="font-medium font-mono">
                  #{summary.merchantNumber}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Reference ID</dt>
              <dd className="min-w-0 font-medium font-mono wrap-anywhere text-right">
                {summary.reference}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Business Name</dt>
              <dd className="min-w-0 font-medium wrap-break-word text-right">
                {summary.businessName}
              </dd>
            </div>
            {submittedOn ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Submitted On</dt>
                <dd className="font-medium">{submittedOn}</dd>
              </div>
            ) : null}
            {summary.documentCount !== null ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Documents Uploaded</dt>
                <dd className="font-medium">{summary.documentCount}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Button type="button" variant="link" onClick={onNewSubmission}>
        Apply for a different business
      </Button>
    </div>
  )
}
