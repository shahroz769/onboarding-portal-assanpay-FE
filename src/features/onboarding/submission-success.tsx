import { useEffect, useRef } from 'react'
import { CheckCircle2, FilePlus2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import type { MerchantSubmissionResponse } from '#/apis/merchant-onboarding'

type SubmissionSuccessProps = {
  data: MerchantSubmissionResponse
  onNewSubmission: () => void
}

export function SubmissionSuccess({
  data,
  onNewSubmission,
}: SubmissionSuccessProps) {
  // This view replaces the form (and the page heading), so the focused submit
  // button is gone; land focus on the new heading instead of <body>.
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="motion-success-enter flex flex-col items-center gap-6 py-12">
      <div className="motion-success-icon flex size-20 items-center justify-center rounded-full bg-muted">
        <CheckCircle2 aria-hidden="true" className="size-10 text-foreground" />
      </div>

      <div className="text-center">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none"
        >
          Form Submitted Successfully
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your merchant onboarding form has been received and is being
          processed.
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
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reference ID</dt>
              <dd className="font-medium font-mono">{data.merchant.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Business Name</dt>
              <dd className="font-medium">{data.merchant.businessName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">
                {data.merchant.status.replace(/_/g, ' ')}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Documents Uploaded</dt>
              <dd className="font-medium">{data.documents.length}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Button type="button" onClick={onNewSubmission}>
        <FilePlus2 data-icon="inline-start" />
        Submit another application
      </Button>
    </div>
  )
}
