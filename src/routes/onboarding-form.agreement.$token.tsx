import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import axios from 'axios'

import { agreementUploadContextQueryOptions } from '#/apis/merchant-onboarding'
import { Spinner } from '#/components/ui/spinner'
import { AgreementUploadForm } from '#/features/onboarding/agreement-upload-form'

export const Route = createFileRoute('/onboarding-form/agreement/$token')({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        agreementUploadContextQueryOptions(params.token),
      )
    } catch {
      // Component handles token errors.
    }
  },
  component: AgreementUploadRoute,
})

function AgreementUploadRoute() {
  const { token } = Route.useParams()

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <AgreementUploadContent token={token} />
      </div>
    </main>
  )
}

function AgreementUploadContent({ token }: { token: string }) {
  const query = useQuery(agreementUploadContextQueryOptions(token))

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

  return <AgreementUploadForm token={token} context={query.data} />
}

function TokenErrorScreen({ error }: { error: unknown }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const message =
    axios.isAxiosError(error) && error.response?.data
      ? typeof error.response.data === 'string'
        ? error.response.data
        : (error.response.data as { error?: string }).error
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
              : 'Unable to load agreement'}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {message ??
            (isExpired
              ? 'Ask your account contact to send a new agreement link.'
              : 'Please check the link and try again, or contact support.')}
        </p>
      </div>
    </div>
  )
}
