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
import {
  preloadQueueRenderer,
  resolveQueueWorkflowType,
} from '#/features/cases/case-detail/queue-registry'
import { loadCaseDetailPage } from '#/hooks/use-case-detail-query'
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
  // The skeleton shows as soon as the case is clicked while the loader fetches
  // the case and everything around it in parallel, and leaves as soon as the
  // case arrives. A failed case request lands in CaseDetailsError.
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: CaseDetailsPending,
  loader: async ({ context: { queryClient }, params: { caseId }, preload }) => {
    // Hovering a case link (a table row) must not fetch it; the click does.
    if (preload) return
    const detail = await loadCaseDetailPage(queryClient, caseId)
    preloadQueueRenderer(resolveQueueWorkflowType(detail.queue))
  },
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
            // Reset the failed query so the re-run loader requests it again.
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
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center gap-4 p-6">
      {children}
    </div>
  )
}
