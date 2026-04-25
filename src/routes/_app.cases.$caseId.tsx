import { AxiosError } from 'axios'
import type { ReactNode } from 'react'
import {
  Link,
  createFileRoute,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import { AlertTriangle, FileQuestion, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  CaseDetailShell,
  CaseDetailShellSkeleton,
} from '#/features/cases/case-detail'
import { preloadCaseDetailPageQueries } from '#/hooks/use-case-detail-query'
import { getApiErrorMessage } from '#/lib/get-api-error-message'

export const Route = createFileRoute('/_app/cases/$caseId')({
  staticData: {
    title: 'Case Details',
    hidePageShell: true,
  },
  pendingMs: 0,
  pendingComponent: CaseDetailsPending,
  loader: async ({ context, params }) => {
    try {
      return await preloadCaseDetailPageQueries(
        context.queryClient,
        params.caseId,
      )
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw notFound()
      }

      throw error
    }
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
      <Alert>
        <FileQuestion />
        <AlertTitle>Case not found</AlertTitle>
        <AlertDescription>
          Case {caseId} could not be found. It may have been removed or you may
          be using an old link.
        </AlertDescription>
      </Alert>
      <Button asChild variant="outline">
        <Link to="/cases/all-cases">Back to cases</Link>
      </Button>
    </RouteStateShell>
  )
}

function CaseDetailsError({ error }: { error: unknown }) {
  const router = useRouter()
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
      <Alert variant={isForbidden ? 'default' : 'destructive'}>
        <AlertTriangle />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            void router.invalidate()
          }}
        >
          <RefreshCw />
          Retry
        </Button>
        <Button asChild variant="outline">
          <Link to="/cases/all-cases">Back to cases</Link>
        </Button>
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
