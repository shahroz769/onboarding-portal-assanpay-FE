import { AxiosError } from 'axios'
import type { ReactNode } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileQuestion, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button, ButtonLink } from '#/components/ui/button'
import {
  CaseDetailShell,
  CaseDetailShellSkeleton,
} from '#/features/cases/case-detail'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { parseUuidParam } from '#/lib/route-params'

export const Route = createFileRoute('/_app/cases/$caseId')({
  params: {
    parse: ({ caseId }) => ({ caseId: parseUuidParam(caseId) }),
  },
  staticData: {
    title: 'Case Details',
    hidePageShell: true,
  },
  pendingMs: 0,
  pendingComponent: CaseDetailsPending,
  // No loader: CaseDetailShell fetches the case and everything around it
  // itself; a failed case request is rethrown into CaseDetailsError.
  errorComponent: CaseDetailsError,
  notFoundComponent: CaseDetailsNotFound,
  component: CaseDetailsRoute,
})

function CaseDetailsRoute() {
  const { caseId } = Route.useParams()

  return <CaseDetailShell caseId={caseId} />
}

function CaseDetailsPending() {
  return <CaseDetailShellSkeleton />
}

function CaseDetailsNotFound() {
  const { caseId } = Route.useParams()

  return (
    <RouteStateShell>
      <Alert variant="warning">
        <FileQuestion />
        <AlertTitle>Case not found</AlertTitle>
        <AlertDescription>
          Case {caseId} could not be found. It may have been removed or you may
          be using an old link.
        </AlertDescription>
      </Alert>
      <ButtonLink variant="outline" render={<Link to="/cases/all-cases" />}>
        Back to cases
      </ButtonLink>
    </RouteStateShell>
  )
}

function CaseDetailsError({ error }: { error: unknown }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  if (error instanceof AxiosError && error.response?.status === 404) {
    return <CaseDetailsNotFound />
  }

  const isForbidden =
    error instanceof AxiosError && error.response?.status === 403
  const title = isForbidden ? 'Access denied' : 'Case could not be loaded'
  const message = getApiErrorMessage(
    error,
    isForbidden
      ? 'You do not have access to this case.'
      : 'The case detail request failed. Please try again.',
  )

  return (
    <RouteStateShell>
      <Alert variant={isForbidden ? 'warning' : 'destructive'}>
        <AlertTriangle />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            // Reset the failed query so the page requests it again.
            void queryClient.resetQueries({
              predicate: (query) => query.state.status === 'error',
            })
            void router.invalidate()
          }}
        >
          <RefreshCw />
          Retry
        </Button>
        <ButtonLink variant="outline" render={<Link to="/cases/all-cases" />}>
          Back to cases
        </ButtonLink>
      </div>
    </RouteStateShell>
  )
}

function RouteStateShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center gap-4 p-6">
      {children}
    </main>
  )
}
