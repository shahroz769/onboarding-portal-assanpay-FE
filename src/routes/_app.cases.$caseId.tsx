import { createFileRoute } from '@tanstack/react-router'

import {
  CaseDetailShell,
  CaseDetailShellSkeleton,
} from '#/features/cases/case-detail'
import { preloadCaseDetailPageQueries } from '#/hooks/use-case-detail-query'

export const Route = createFileRoute('/_app/cases/$caseId')({
  staticData: {
    title: 'Case Details',
    hidePageShell: true,
  },
  pendingMs: 0,
  pendingComponent: CaseDetailsPending,
  loader: ({ context, params }) =>
    preloadCaseDetailPageQueries(context.queryClient, params.caseId),
  component: CaseDetailsRoute,
})

function CaseDetailsRoute() {
  const { caseId } = Route.useParams()

  return <CaseDetailShell caseId={caseId} />
}

function CaseDetailsPending() {
  return <CaseDetailShellSkeleton />
}
