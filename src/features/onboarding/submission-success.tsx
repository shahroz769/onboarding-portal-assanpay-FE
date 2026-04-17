import { CheckCircle2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card"
import type { MerchantSubmissionResponse } from "#/apis/merchant-onboarding"

type SubmissionSuccessProps = {
  data: MerchantSubmissionResponse
}

export function SubmissionSuccess({ data }: SubmissionSuccessProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="size-10 text-emerald-500" />
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Form Submitted Successfully
        </h2>
        <p className="mt-2 text-muted-foreground">
          Your merchant onboarding form has been received and is being processed.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
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
                {data.merchant.status.replace(/_/g, " ")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Documents Uploaded</dt>
              <dd className="font-medium">{data.documents.length}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
