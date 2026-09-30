import { AxiosError } from 'axios'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  FileQuestion,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import { ErrorPage } from '#/components/error-state'
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
import { useRouteRetry } from '#/hooks/use-route-retry'
import { getErrorStateMessage } from '#/lib/get-api-error-message'
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
    <ErrorPage
      tone="warning"
      icon={<FileQuestion />}
      title="Case not found"
      description={`No case matches ID ${caseId}. It may have been removed, or the link may be out of date.`}
      actions={
        <ButtonLink render={<Link to="/cases/all-cases" />}>
          Back to cases
        </ButtonLink>
      }
    />
  )
}

function CaseDetailsError({ error }: { error: unknown }) {
  const retryRoute = useRouteRetry()

  if (error instanceof AxiosError && error.response?.status === 404) {
    return <CaseDetailsNotFound />
  }

  if (error instanceof AxiosError && error.response?.status === 403) {
    return (
      <ErrorPage
        tone="warning"
        icon={<ShieldAlert />}
        title="Access denied"
        description={getErrorStateMessage(
          error,
          'Your account does not have access to this case. Ask an administrator if you need it.',
        )}
        actions={
          <ButtonLink render={<Link to="/cases/all-cases" />}>
            Back to cases
          </ButtonLink>
        }
      />
    )
  }

  return (
    <ErrorPage
      icon={<AlertTriangle />}
      title="Unable to load this case"
      description={getErrorStateMessage(
        error,
        'Try again, or go back to the case list.',
      )}
      error={error}
      actions={
        <>
          <Button type="button" onClick={retryRoute}>
            <RefreshCw />
            Try again
          </Button>
          <ButtonLink variant="outline" render={<Link to="/cases/all-cases" />}>
            Back to cases
          </ButtonLink>
        </>
      }
    />
  )
}
