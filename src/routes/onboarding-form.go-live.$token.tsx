import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { AlertCircle, CheckCircle2, Clock3, Rocket } from 'lucide-react'

import {
  midGoLiveContextQueryOptions,
  useActivateMidGoLiveMutation,
} from '#/apis/merchant-onboarding'
import type { MidGoLiveContext } from '#/apis/merchant-onboarding'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
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
  const [testedMethodKeys, setTestedMethodKeys] = useState<string[]>([])

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
  const selectedMethodKeys = new Set(testedMethodKeys)
  const allMethodsTested =
    data.testingMethods.length > 0 &&
    data.testingMethods.every((method) => selectedMethodKeys.has(method.key))

  function setMethodTested(methodKey: string, checked: boolean) {
    setTestedMethodKeys((current) => {
      if (checked) {
        return current.includes(methodKey) ? current : [...current, methodKey]
      }
      return current.filter((key) => key !== methodKey)
    })
  }

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

        {status !== 'started' ? (
          <section className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">Confirm completed testing</h2>
              <p className="text-sm text-muted-foreground">
                Perform low-amount tests and select every enabled method below.
                You can go live only after all collection and disbursement
                methods have been tested.
              </p>
            </div>

            <TestingMethodGroup
              title="Collection methods"
              methods={data.testingMethods.filter(
                (method) => method.type === 'collection',
              )}
              selectedMethodKeys={selectedMethodKeys}
              disabled={status !== 'ready' || activate.isPending}
              onCheckedChange={setMethodTested}
            />
            <TestingMethodGroup
              title="Disbursement methods"
              methods={data.testingMethods.filter(
                (method) => method.type === 'disbursement',
              )}
              selectedMethodKeys={selectedMethodKeys}
              disabled={status !== 'ready' || activate.isPending}
              onCheckedChange={setMethodTested}
            />

            <p className="text-sm text-muted-foreground">
              After testing, withdraw your balance. Settlement is T+2 and is
              processed at 12:00 AM after each 48-hour period.
            </p>
          </section>
        ) : null}

        <div className="flex justify-end">
          <Button
            onClick={() => activate.mutate(testedMethodKeys)}
            disabled={
              status !== 'ready' || !allMethodsTested || activate.isPending
            }
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

type TestingMethod = MidGoLiveContext['testingMethods'][number]

function TestingMethodGroup({
  title,
  methods,
  selectedMethodKeys,
  disabled,
  onCheckedChange,
}: {
  title: string
  methods: TestingMethod[]
  selectedMethodKeys: Set<string>
  disabled: boolean
  onCheckedChange: (methodKey: string, checked: boolean) => void
}) {
  if (methods.length === 0) return null

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {methods.map((method) => (
        <label
          key={method.key}
          className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
        >
          <Checkbox
            checked={selectedMethodKeys.has(method.key)}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onCheckedChange(method.key, checked === true)
            }
          />
          <span>{method.label}</span>
        </label>
      ))}
    </fieldset>
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
