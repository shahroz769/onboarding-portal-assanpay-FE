import { useEffect } from 'react'

import { ListRestart } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'

import { Spinner } from '#/components/ui/spinner'

import {
  useCreateMissingCloseTriggerCasesMutation,
  usePreviewMissingCloseTriggerCasesMutation,
} from '#/hooks/use-configuration-query'

export function CaseFlowBackfillDialog({
  triggerId,
  onOpenChange,
}: {
  triggerId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const previewMutation = usePreviewMissingCloseTriggerCasesMutation()
  const backfillMutation = useCreateMissingCloseTriggerCasesMutation()
  const previewMutate = previewMutation.mutate
  const previewReset = previewMutation.reset
  const backfillReset = backfillMutation.reset

  useEffect(() => {
    if (!triggerId) return
    previewReset()
    backfillReset()
    previewMutate(triggerId)
  }, [triggerId, previewMutate, previewReset, backfillReset])

  async function handleBackfill() {
    if (!triggerId) return
    try {
      const result = await backfillMutation.mutateAsync(triggerId)
      if (result.failedMerchantCount === 0) {
        onOpenChange(false)
      } else {
        previewMutation.mutate(triggerId)
      }
    } catch {
      // The mutation displays the API error and keeps the confirmation open.
    }
  }

  return (
    <AlertDialog
      open={Boolean(triggerId)}
      onOpenChange={(open) => {
        if (!open && !backfillMutation.isPending) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create missing cases?</AlertDialogTitle>
          <AlertDialogDescription>
            This checks the saved close trigger and immediately creates cases
            only for merchants who successfully closed the source case and have
            never had the target case.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {previewMutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Checking merchant case history…
          </div>
        ) : previewMutation.data ? (
          <Alert>
            <AlertTitle>
              {previewMutation.data.eligibleMerchantCount === 0
                ? 'No missing cases'
                : `${previewMutation.data.eligibleMerchantCount} merchant${previewMutation.data.eligibleMerchantCount === 1 ? '' : 's'} found`}
            </AlertTitle>
            <AlertDescription>
              {previewMutation.data.trigger.sourceQueueName} →{' '}
              {previewMutation.data.trigger.targetQueueName}
              {previewMutation.data.eligibleMerchantCount > 0
                ? `. Not previously queued: ${previewMutation.data.jobBreakdown.neverQueued}; retrying with errors: ${previewMutation.data.jobBreakdown.failed}; pending: ${previewMutation.data.jobBreakdown.pending}`
                : ''}
              {previewMutation.data.sampleMerchants.length > 0
                ? `. Includes ${previewMutation.data.sampleMerchants.map((merchant) => merchant.merchantName).join(', ')}${previewMutation.data.eligibleMerchantCount > previewMutation.data.sampleMerchants.length ? ', and others' : ''}.`
                : '.'}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Unable to check missing cases</AlertTitle>
            <AlertDescription>
              Close this dialog and try again.
            </AlertDescription>
          </Alert>
        )}

        {previewMutation.data?.retryIssues.length ? (
          <Alert variant="destructive">
            <AlertTitle>Why automatic retries are failing</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-4">
                {previewMutation.data.retryIssues.map((issue) => (
                  <li key={issue.merchantId}>
                    {issue.merchantName} ({issue.attempts} attempts):{' '}
                    {issue.error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {backfillMutation.data?.failedMerchantCount ? (
          <Alert variant="destructive">
            <AlertTitle>
              Created for {backfillMutation.data.createdMerchantCount}; failed
              for {backfillMutation.data.failedMerchantCount}
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-4">
                {backfillMutation.data.failures.map((failure) => (
                  <li key={failure.merchantId}>
                    {failure.merchantName}: {failure.error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={backfillMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={
              previewMutation.isPending ||
              !previewMutation.data ||
              previewMutation.data.eligibleMerchantCount === 0 ||
              backfillMutation.isPending
            }
            onClick={(event) => {
              event.preventDefault()
              void handleBackfill()
            }}
          >
            {backfillMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ListRestart data-icon="inline-start" />
            )}
            {backfillMutation.isPending
              ? 'Creating cases'
              : 'Create missing cases now'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
