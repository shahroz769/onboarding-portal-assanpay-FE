import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import axios from 'axios'

import { resubmissionContextQueryOptions } from '#/apis/merchant-onboarding'
import { Spinner } from '#/components/ui/spinner'
import { ResubmissionForm } from '#/features/onboarding/resubmission-form'
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
      <LinkStatusScreen
        tone="error"
        title="Link not found"
        message="Please check the link and try again, or contact support."
      />
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
    return <TokenErrorScreen error={query.error} />
  }

  return <ResubmissionForm token={token} context={query.data} />
}

function TokenErrorScreen({ error }: { error: unknown }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const message =
    axios.isAxiosError(error) && error.response?.data
      ? typeof error.response.data === 'string'
        ? error.response.data
        : (error.response.data as { error?: string }).error
      : null

  const isGone = status === 410
  const isTimeExpired =
    isGone && message?.toLowerCase().includes('expired') === true
  const isMissing = status === 404

  return (
    <LinkStatusScreen
      tone={isGone ? 'neutral' : 'error'}
      title={
        isGone
          ? isTimeExpired
            ? 'This link has expired'
            : 'This link was already used or replaced'
          : isMissing
            ? 'Link not found'
            : 'Unable to load resubmission'
      }
      message={
        message ??
        (isGone
          ? 'Ask your account contact to send a new resubmission link.'
          : 'Please check the link and try again, or contact support.')
      }
    />
  )
}

function LinkStatusScreen({
  tone,
  title,
  message,
}: {
  tone: 'neutral' | 'error'
  title: string
  message: string
}) {
  return (
    <div className="rounded-xl border bg-background p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        {tone === 'neutral' ? (
          <CheckCircle2 className="size-10 text-muted-foreground" />
        ) : (
          <AlertCircle className="size-10 text-destructive" />
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
