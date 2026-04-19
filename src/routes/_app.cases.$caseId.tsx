import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/$caseId')({
  staticData: {
    title: 'Case Details',
    subtitle: 'View and manage case information.',
  },
  component: CaseDetailsRoute,
})

function CaseDetailsRoute() {
  const { caseId } = Route.useParams()

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-muted-foreground">
        Case details for <span className="font-mono font-medium">{caseId}</span> coming soon.
      </p>
    </div>
  )
}
