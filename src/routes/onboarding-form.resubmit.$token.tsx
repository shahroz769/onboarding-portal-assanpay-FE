import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import axios from 'axios'

import { resubmissionContextQueryOptions } from '#/apis/merchant-onboarding'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'
import { ResubmissionForm } from '#/features/onboarding/resubmission-form'

export const Route = createFileRoute('/onboarding-form/resubmit/$token')({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        resubmissionContextQueryOptions(params.token),
      )
    } catch {
      // Component will handle the error via useSuspenseQuery
    }
  },
  component: ResubmissionRoute,
})

function ResubmissionRoute() {
  const { token } = Route.useParams()

  return (
    <main className="min-h-svh bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <ResubmissionContent token={token} />
      </div>
    </main>
  )
}

function ResubmissionContent({ token }: { token: string }) {
  const query = useQuery(resubmissionContextQueryOptions(token))

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

  if (!query.data) {
    return <TokenErrorScreen error={new Error('Unable to load resubmission')} />
  }

  return <ResubmissionForm token={token} context={query.data} />
}

function TokenErrorScreen({ error }: { error: unknown }) {
  const router = useRouter()
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const message =
    axios.isAxiosError(error) && error.response?.data
      ? typeof error.response.data === 'string'
        ? error.response.data
        : (error.response.data as { error?: string })?.error
      : null

  const isExpired = status === 410
  const isMissing = status === 404

  return (
    <div className="rounded-xl border bg-background p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        {isExpired ? (
          <CheckCircle2 className="size-10 text-muted-foreground" />
        ) : (
          <AlertCircle className="size-10 text-destructive" />
        )}
        <h1 className="text-2xl font-semibold">
          {isExpired
            ? 'This link has expired or was already used'
            : isMissing
              ? 'Link not found'
              : 'Unable to load resubmission'}
        </h1>
        <Alert variant={isExpired ? 'default' : 'destructive'}>
          <AlertTitle>
            {isExpired
              ? 'Reach out to your case owner'
              : 'Something went wrong'}
          </AlertTitle>
          <AlertDescription>
            {message ??
              (isExpired
                ? 'Ask your account contact to send a new resubmission link.'
                : 'Please check the link and try again, or contact support.')}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.navigate({ to: '/' })}>
          Return home
        </Button>
      </div>
    </div>
  )
}
