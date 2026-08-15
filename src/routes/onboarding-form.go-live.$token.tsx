import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { AlertCircle, CheckCircle2, Clock3, Rocket } from 'lucide-react'

import {
  midGoLiveContextQueryOptions,
  useActivateMidGoLiveMutation,
} from '#/apis/merchant-onboarding'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Spinner } from '#/components/ui/spinner'
import { MotionSwap } from '#/components/ui/motion-swap'

export const Route = createFileRoute('/onboarding-form/go-live/$token')({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        midGoLiveContextQueryOptions(params.token),
      )
    } catch {
      // Component handles token errors.
    }
  },
  component: MidGoLiveRoute,
})

function MidGoLiveRoute() {
  const { token } = Route.useParams()

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <MidGoLiveContent token={token} />
      </div>
    </main>
  )
}

function MidGoLiveContent({ token }: { token: string }) {
  const query = useQuery(midGoLiveContextQueryOptions(token))
  const activate = useActivateMidGoLiveMutation(token)

  if (query.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-background p-8">
        <Spinner />
      </div>
    )
  }

  if (query.error) {
    return <TokenErrorScreen error={query.error} />
  }

  const data = query.data
  const activationData = activate.data
  const liveCaseNumber =
    activationData?.liveCaseNumber ?? data.liveCaseNumber ?? null
  const status = activationData ? 'started' : data.status
  const availableAt = formatDateTime(data.availableAt)
  const availabilityLabel = formatAvailabilityHours(data.availableInHours)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Go-Live</CardTitle>
        <CardDescription>{data.merchantName}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <MotionSwap motionKey={status}>
          {status === 'not_ready' ? (
            <Alert variant="warning">
              <Clock3 />
              <AlertTitle>
                {availabilityLabel
                  ? `Go-Live unlocks after ${availabilityLabel}`
                  : 'Go-Live is not available yet'}
              </AlertTitle>
              <AlertDescription>
                This link will work after {availableAt}. Until then, complete
                testing in the merchant portal.
              </AlertDescription>
            </Alert>
          ) : status === 'started' ? (
            <Alert variant="success">
              <CheckCircle2 />
              <AlertTitle>Live process started</AlertTitle>
              <AlertDescription>
                Your request has been submitted to AssanPay onboarding.
                {liveCaseNumber ? ` Reference: ${liveCaseNumber}.` : null}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Rocket />
              <AlertTitle>Ready for live activation</AlertTitle>
              <AlertDescription>
                Select Go Live to start the live activation process.
              </AlertDescription>
            </Alert>
          )}
        </MotionSwap>

        <div className="flex justify-end">
          <Button
            onClick={() => activate.mutate()}
            disabled={status !== 'ready' || activate.isPending}
          >
            {activate.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Rocket data-icon="inline-start" />
            )}
            {activate.isPending ? 'Starting' : 'Go Live'}
          </Button>
        </div>

        {activate.error ? <ActivationError error={activate.error} /> : null}
      </CardContent>
    </Card>
  )
}

function TokenErrorScreen({ error }: { error: unknown }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const message =
    axios.isAxiosError(error) && error.response?.data
      ? typeof error.response.data === 'string'
        ? error.response.data
        : (error.response.data as { error?: string }).error
      : null

  return (
    <div className="rounded-xl border bg-background p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {status === 404 ? 'Link not found' : 'Unable to load Go-Live'}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {message ??
            'Please check the link and try again, or contact support.'}
        </p>
      </div>
    </div>
  )
}

function ActivationError({ error }: { error: unknown }) {
  const message =
    axios.isAxiosError(error) && error.response?.data
      ? typeof error.response.data === 'string'
        ? error.response.data
        : (error.response.data as { error?: string }).error
      : null

  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Go-Live could not start</AlertTitle>
      <AlertDescription>
        {message ?? 'Please try again or contact support.'}
      </AlertDescription>
    </Alert>
  )
}

function formatDateTime(value: string) {
  return GO_LIVE_DATE_TIME_FORMATTER.format(new Date(value))
}

function formatAvailabilityHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return null
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}
const GO_LIVE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Karachi',
})
