import { useRef } from 'react'
import { ExternalLink, MailCheck, Send, ShieldAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Spinner } from '#/components/ui/spinner'
import { useAuth } from '#/features/auth/auth-client'
import { useSendSubMerchantFormEmail } from '#/hooks/use-case-detail-query'
import type { CaseDetail } from '#/schemas/cases.schema'

interface SubMerchantFormReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseDetail: CaseDetail
  caseId: string
}

export function SubMerchantFormReviewModal({
  open,
  onOpenChange,
  caseDetail,
  caseId,
}: SubMerchantFormReviewModalProps) {
  const { user } = useAuth()
  const sendEmail = useSendSubMerchantFormEmail(caseId)
  const isConfirmingRef = useRef(false)
  const details = caseDetail.subMerchantForm ?? null
  const merchant = caseDetail.merchant as {
    submitterEmail?: string | null
  } | null
  const submitterEmail = merchant?.submitterEmail ?? null
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const finalForm = details?.finalForm ?? null
  const canSend =
    Boolean(details) &&
    Boolean(finalForm) &&
    Boolean(submitterEmail) &&
    isCaseOwner &&
    caseDetail.case.status === 'working' &&
    !sendEmail.isPending

  async function handleSend() {
    if (!canSend || isConfirmingRef.current) return

    isConfirmingRef.current = true
    try {
      const data = await sendEmail.mutateAsync()
      if (data.status === 'sent') {
        onOpenChange(false)
      }
    } catch {
      // Mutation hook already shows the error toast.
    } finally {
      isConfirmingRef.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Review Final Form</DialogTitle>
          <DialogDescription>
            Confirm the selected sub-merchant and Final Form before sending the
            email.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {details ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Sub-merchant
              </p>
              <p className="mt-1 text-sm font-medium">
                {details.subMerchantName}
              </p>
            </div>
          ) : (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>No sub-merchant selected</AlertTitle>
              <AlertDescription>
                Select a sub-merchant before sending the Final Form email.
              </AlertDescription>
            </Alert>
          )}

          {finalForm ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {finalForm.originalName}
                </p>
                <p className="text-sm text-muted-foreground">Final Form</p>
              </div>
              <Button asChild variant="outline">
                <a
                  href={finalForm.googleDriveWebViewLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink data-icon="inline-start" />
                  View final form
                </a>
              </Button>
            </div>
          ) : (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>No Final Form uploaded</AlertTitle>
              <AlertDescription>
                Upload the completed Final Form before sending email.
              </AlertDescription>
            </Alert>
          )}

          {submitterEmail ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Recipient
              </p>
              <p className="mt-1 text-sm font-medium">{submitterEmail}</p>
            </div>
          ) : (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>No recipient on file</AlertTitle>
              <AlertDescription>
                We do not have a submitter email for this merchant.
              </AlertDescription>
            </Alert>
          )}

          {details?.emailStatus === 'sent' ? (
            <Alert>
              <MailCheck />
              <AlertTitle>Email already sent</AlertTitle>
              <AlertDescription>
                The Final Form email was sent successfully. You can close the
                case from the Resolution tab.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sendEmail.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {sendEmail.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            {sendEmail.isPending ? 'Sending email' : 'Send mail'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
