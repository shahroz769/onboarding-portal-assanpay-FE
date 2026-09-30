import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Clock3, RefreshCw } from 'lucide-react'
import axios from 'axios'

import { resubmissionContextQueryOptions } from '#/apis/merchant-onboarding'
import { ErrorState } from '#/components/error-state'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'
import { ResubmissionForm } from '#/features/onboarding/resubmission-form'
import {
  getErrorStateMessage,
  getServerErrorMessage,
} from '#/lib/get-api-error-message'
import { parseTokenParam } from '#/lib/route-params'

export const Route = createFileRoute('/onboarding-form/resubmit/$token')({
  params: {
    parse: ({ token }) => ({ token: parseTokenParam(token) }),
  },
  notFoundComponent: ResubmissionLinkNotFound,
  // No loader: ResubmissionContent fetches the context itself and renders its
  // own loading and error states. (A loader fetch here made a failed token
  // request twice, since the page's query refetches an errored query.)
  component: ResubmissionRoute,
})

function ResubmissionRoute() {
  const { token } = Route.useParams()

  return (
    <ResubmissionPageFrame>
      <ResubmissionContent token={token} />
    </ResubmissionPageFrame>
  )
}

function ResubmissionPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-3xl">{children}</div>
    </main>
  )
}

/** Malformed tokens are rejected by params.parse before any request is made. */
function ResubmissionLinkNotFound() {
  return (
    <ResubmissionPageFrame>
      <LinkNotFound />
    </ResubmissionPageFrame>
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
    return (
      <TokenErrorScreen
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    )
  }

  return <ResubmissionForm token={token} context={query.data} />
}

function LinkNotFound() {
  return (
    <ErrorState
      surface
      className="mx-auto"
      icon={<AlertCircle />}
      title="Link not found"
      description="Check that you opened the complete link from your email, or contact support for a new one."
    />
  )
}

function TokenErrorScreen({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const serverMessage = getServerErrorMessage(error)

  if (status === 404) return <LinkNotFound />

  if (status === 410) {
    const isTimeExpired =
      serverMessage?.toLowerCase().includes('expired') === true
    return (
      <ErrorState
        surface
        className="mx-auto"
        tone="muted"
        icon={<Clock3 />}
        title={
          isTimeExpired
            ? 'This link has expired'
            : 'This link was already used or replaced'
        }
        description={
          serverMessage ??
          'Ask your account contact to send a new resubmission link.'
        }
      />
    )
  }

  return (
    <ErrorState
      surface
      className="mx-auto"
      icon={<AlertCircle />}
      title="Unable to open this link"
      description={getErrorStateMessage(
        error,
        'Try again. If it keeps happening, contact support.',
      )}
      error={error}
      actions={
        <Button type="button" onClick={onRetry}>
          <RefreshCw />
          Try again
        </Button>
      }
    />
  )
}
