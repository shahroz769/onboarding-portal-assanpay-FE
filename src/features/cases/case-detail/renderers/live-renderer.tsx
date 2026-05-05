import { CheckCircle2, Info, Rocket } from 'lucide-react'

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
import { Checkbox } from '#/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { useAuth } from '#/features/auth/auth-client'
import { useMarkLiveLimitsApplied } from '#/hooks/use-case-detail-query'

import type { QueueRendererProps } from '../queue-registry'

export default function LiveRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const markLimitsApplied = useMarkLiveLimitsApplied(caseId)
  const limitsAppliedAt = caseDetail.live?.limitsAppliedAt ?? null
  const limitsAppliedBy = caseDetail.live?.limitsAppliedBy?.name ?? null
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canConfirm = isCaseOwner && isWorking && !limitsAppliedAt

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>Live Limits</CardTitle>
            <CardDescription>
              Confirm the merchant live limits before closing this case.
            </CardDescription>
          </div>
          <Badge variant={limitsAppliedAt ? 'secondary' : 'outline'}>
            {limitsAppliedAt ? <CheckCircle2 /> : <Rocket />}
            {limitsAppliedAt ? 'Applied' : 'Pending'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <LimitBlock label="Collection" value="100-50,000" />
          <LimitBlock label="Disbursement" value="1000-50,000" />
        </div>

        <FieldGroup>
          <Field orientation="horizontal" data-disabled={!canConfirm}>
            <Checkbox
              id="live-limits-applied"
              checked={Boolean(limitsAppliedAt)}
              disabled={!canConfirm || markLimitsApplied.isPending}
              onCheckedChange={(checked) => {
                if (checked === true) {
                  markLimitsApplied.mutate()
                }
              }}
            />
            <FieldContent>
              <FieldLabel htmlFor="live-limits-applied">
                I have applied the live limits
              </FieldLabel>
              <FieldDescription>
                Mark as successful is available after this confirmation is
                saved.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>

        {markLimitsApplied.isPending ? (
          <Button disabled variant="outline">
            <Spinner data-icon="inline-start" />
            Saving confirmation
          </Button>
        ) : null}

        {limitsAppliedAt ? (
          <Alert>
            <CheckCircle2 />
            <AlertTitle>Limits applied</AlertTitle>
            <AlertDescription>
              Confirmed{limitsAppliedBy ? ` by ${limitsAppliedBy}` : ''}. The
              case can now be marked as successful.
            </AlertDescription>
          </Alert>
        ) : !canConfirm && isWorking ? (
          <Alert>
            <Info />
            <AlertTitle>Owner action required</AlertTitle>
            <AlertDescription>
              Only the current case owner can confirm that live limits were
              applied.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LimitBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold">{value}</span>
    </div>
  )
}
