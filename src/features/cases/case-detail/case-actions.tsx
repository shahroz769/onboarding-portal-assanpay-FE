import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ShieldAlert,
  UserRoundPlus,
  Workflow,
} from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import type { CaseDetail } from '#/schemas/cases.schema'
import {
  useAdvanceStage,
  useCloseUnsuccessful,
  useTakeOwnership,
} from '#/hooks/use-case-detail-query'

interface CaseActionsProps {
  caseDetail: CaseDetail
  caseId: string
}

export function CaseActions({ caseDetail, caseId }: CaseActionsProps) {
  const { currentStage, owner } = caseDetail
  const category = currentStage?.category ?? null

  const takeOwnership = useTakeOwnership(caseId)
  const advanceStage = useAdvanceStage(caseId)
  const closeUnsuccessful = useCloseUnsuccessful(caseId)

  const [closeReason, setCloseReason] = useState('')

  const isClosed = category === 'closed' || category === 'error'
  const isNew = category === 'new'
  const isInProgress = category === 'in_progress'
  const hasOwner = Boolean(owner)

  const summary = useMemo(() => {
    if (isClosed) {
      return {
        title: 'Case closed',
        description:
          caseDetail.case.closeOutcome === 'successful'
            ? 'The workflow is complete and the case has been closed successfully.'
            : 'The case has been closed as unsuccessful.',
      }
    }

    if (isNew && !hasOwner) {
      return {
        title: 'Ownership required',
        description:
          'Take ownership to move this case into active review and unlock case actions.',
      }
    }

    if (isInProgress) {
      return {
        title: 'Ready for review actions',
        description:
          'When review notes are saved and the case is ready, submit it to the next stage or close it as unsuccessful.',
      }
    }

    return {
      title: 'Workflow actions',
      description: 'Available actions depend on the current stage and ownership.',
    }
  }, [caseDetail.case.closeOutcome, hasOwner, isClosed, isInProgress, isNew])

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Workflow actions</CardTitle>
            <CardDescription>{summary.description}</CardDescription>
          </div>
          {currentStage ? (
            <Badge variant={isClosed ? 'destructive' : 'secondary'}>
              {currentStage.name}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border bg-background">
              {isClosed ? (
                <CheckCircle2 className="size-4 text-muted-foreground" />
              ) : (
                <Workflow className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">{summary.title}</p>
              <p className="text-sm text-muted-foreground">
                {owner ? `Assigned to ${owner.name}.` : 'No case owner assigned yet.'}
              </p>
            </div>
          </div>
        </div>

        {isNew && !hasOwner ? (
          <Button
            onClick={() => takeOwnership.mutate()}
            disabled={takeOwnership.isPending}
          >
            {takeOwnership.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UserRoundPlus data-icon="inline-start" />
            )}
            {takeOwnership.isPending ? 'Taking ownership' : 'Take ownership'}
          </Button>
        ) : null}

        {isInProgress ? (
          <Button
            onClick={() => advanceStage.mutate()}
            disabled={advanceStage.isPending}
          >
            {advanceStage.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Workflow data-icon="inline-start" />
            )}
            {advanceStage.isPending ? 'Submitting stage' : 'Submit and advance'}
          </Button>
        ) : null}

        {!isClosed && hasOwner ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <ShieldAlert data-icon="inline-start" />
                Reject case
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close case as unsuccessful</AlertDialogTitle>
                <AlertDialogDescription>
                  This action moves the case to its closed stage. Provide a
                  clear reason so the closure is visible in the case record and
                  history.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="close-reason">Closure remarks</FieldLabel>
                  <Textarea
                    id="close-reason"
                    value={closeReason}
                    onChange={(event) => setCloseReason(event.target.value)}
                    placeholder="Explain why the case is being rejected or closed."
                    className="min-h-28"
                  />
                  <FieldDescription>
                    Required before the case can be closed unsuccessfully.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={
                    !closeReason.trim() || closeUnsuccessful.isPending
                  }
                  onClick={() =>
                    closeUnsuccessful.mutate({ reason: closeReason.trim() })
                  }
                >
                  {closeUnsuccessful.isPending ? 'Closing case' : 'Close case'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {isClosed && caseDetail.case.closeReason ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-destructive">
              Closure remarks
            </p>
            <p className="mt-1 text-sm">{caseDetail.case.closeReason}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
