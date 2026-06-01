import { useState } from 'react'

import { CheckCircle2, FlaskConical, Info, Mail, MailCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { EmailModeChoice } from '#/components/case-email/email-mode-choice'
import { ManualEmailPanel } from '#/components/case-email/manual-email-panel'
import { WhatsAppMessagePanel } from '#/components/case-email/whatsapp-message-panel'
import { useAuth } from '#/features/auth/auth-client'
import {
  caseHistoryQueryOptions,
  useConfirmMidCreationEmailManual,
  useFetchMidCreationEmailPreview,
  useMarkTestingLimitsApplied,
  useSendMidCreationEmail,
} from '#/hooks/use-case-detail-query'
import { configurationQueryOptions } from '#/hooks/use-configuration-query'
import type { EmailPreviewResult } from '#/apis/cases'

import type { QueueRendererProps } from '../queue-registry'

export default function TestingRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const configurationQuery = useQuery(configurationQueryOptions())
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))
  const markLimitsApplied = useMarkTestingLimitsApplied(caseId)
  const sendCredentialsEmail = useSendMidCreationEmail(caseId)
  const fetchPreview = useFetchMidCreationEmailPreview(caseId)
  const confirmManual = useConfirmMidCreationEmailManual(caseId)
  const emailMode = configurationQuery.data?.emailSendingMode ?? {
    autoEnabled: true,
    manualEnabled: true,
  }
  const limits = configurationQuery.data?.limitsAndMdr.testing
  const limitsAppliedAt = caseDetail.testing?.limitsAppliedAt ?? null
  const limitsAppliedBy = caseDetail.testing?.limitsAppliedBy?.name ?? null
  const credentialsReady = Boolean(caseDetail.testing?.credentialsReady)
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const canConfirm = isCaseOwner && isWorking && !limitsAppliedAt
  const credentialsEmailSent = Boolean(
    historyQuery.data?.some(
      (entry) =>
        entry.action === 'mid_creation_email_sent' ||
        entry.action === 'mid_creation_email_sent_manual',
    ),
  )
  const canSendCredentials =
    isCaseOwner &&
    isWorking &&
    credentialsReady &&
    !credentialsEmailSent &&
    !historyQuery.isPending
  const activeWhatsappNumber =
    typeof caseDetail.merchant.activeWhatsappNumber === 'string'
      ? caseDetail.merchant.activeWhatsappNumber
      : null
  const [reviewOpen, setReviewOpen] = useState(false)
  const [manualPreview, setManualPreview] = useState<EmailPreviewResult | null>(
    null,
  )

  function handleReview() {
    if (!canSendCredentials) return
    setManualPreview(null)
    setReviewOpen(true)
  }

  async function handleSendMail() {
    if (!canSendCredentials) return
    await sendCredentialsEmail.mutateAsync({})
    setReviewOpen(false)
  }

  async function handleLoadManualPreview() {
    if (!canSendCredentials) return
    const data = await fetchPreview.mutateAsync({})
    setManualPreview(data)
  }

  async function handleManualConfirm(file: File) {
    if (!manualPreview) return
    await confirmManual.mutateAsync({
      tokenId: manualPreview.tokenId,
      file,
    })
    setReviewOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Testing Limits</CardTitle>
              <CardDescription>
                Confirm the merchant testing limits before closing this case.
              </CardDescription>
            </div>
            <Badge variant={limitsAppliedAt ? 'secondary' : 'outline'}>
              {limitsAppliedAt ? <CheckCircle2 /> : <FlaskConical />}
              {limitsAppliedAt ? 'Applied' : 'Pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <LimitBlock
              label="Collection"
              value={`${limits?.collectionMin ?? 10}-${limits?.collectionMax ?? 100}`}
            />
            <LimitBlock
              label="Disbursement"
              value={`${limits?.disbursementMin ?? 1000}-${limits?.disbursementMax ?? 50000}`}
            />
          </div>

          <FieldGroup>
            <Field orientation="horizontal" data-disabled={!canConfirm}>
              <Checkbox
                id="testing-limits-applied"
                checked={Boolean(limitsAppliedAt)}
                disabled={!canConfirm || markLimitsApplied.isPending}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    markLimitsApplied.mutate()
                  }
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor="testing-limits-applied">
                  I have applied the testing limits
                </FieldLabel>
                <FieldDescription>
                  Mark as successful is available after this confirmation is
                  saved.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          {markLimitsApplied.isPending ? (
            <Button disabled variant="outline">
              <Spinner data-icon="inline-start" />
              Saving confirmation
            </Button>
          ) : null}

          {limitsAppliedAt ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Limits applied</AlertTitle>
              <AlertDescription>
                Confirmed{limitsAppliedBy ? ` by ${limitsAppliedBy}` : ''}. The
                case can now be marked as successful.
              </AlertDescription>
            </Alert>
          ) : !canConfirm && isWorking ? (
            <Alert>
              <Info />
              <AlertTitle>Owner action required</AlertTitle>
              <AlertDescription>
                Only the current case owner can confirm that testing limits were
                applied.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Send Credentials Mail</CardTitle>
              <CardDescription>
                Send the saved merchant portal credentials and Go-Live link
                without viewing the MID, email, or password.
              </CardDescription>
            </div>
            <Badge variant={credentialsEmailSent ? 'secondary' : 'outline'}>
              {credentialsEmailSent ? <MailCheck /> : <Mail />}
              {credentialsEmailSent ? 'Sent' : 'Ready'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Alert>
              <Info />
              <AlertTitle>
                {credentialsReady
                  ? 'Credentials ready'
                  : 'Credentials required'}
              </AlertTitle>
              <AlertDescription>
                {credentialsReady
                  ? 'Merchant portal credentials were saved in the MID Creation case. They are hidden in Testing and will be sent by the system.'
                  : 'Save the portal MID, email, and password in the MID Creation case before sending this mail.'}
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={handleReview}
                disabled={!canSendCredentials || sendCredentialsEmail.isPending}
              >
                <Mail data-icon="inline-start" />
                Send mail
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {!credentialsReady && isWorking ? (
        <Alert>
          <Info />
          <AlertTitle>Portal credentials required</AlertTitle>
          <AlertDescription>
            Save the portal MID, email, and password in the MID Creation case
            before sending credentials from Testing.
          </AlertDescription>
        </Alert>
      ) : credentialsEmailSent ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Credentials email already sent</AlertTitle>
          <AlertDescription>
            Merchant portal credentials were sent for this Testing case.
          </AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send credentials mail</DialogTitle>
          </DialogHeader>

          <Alert>
            <MailCheck />
            <AlertTitle>Credentials stay hidden</AlertTitle>
            <AlertDescription>
              Send the saved merchant portal credentials and Go-Live link by
              email or WhatsApp, then save the sent-message screenshot for
              manual delivery.
            </AlertDescription>
          </Alert>

          <EmailModeChoice
            mode={emailMode}
            autoContent={
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setReviewOpen(false)}
                  disabled={sendCredentialsEmail.isPending}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSendMail}
                  disabled={
                    sendCredentialsEmail.isPending || credentialsEmailSent
                  }
                >
                  {sendCredentialsEmail.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {sendCredentialsEmail.isPending
                    ? 'Sending mail'
                    : 'Send mail to client'}
                </Button>
              </DialogFooter>
            }
            manualContent={
              !manualPreview ? (
                <Button
                  onClick={handleLoadManualPreview}
                  disabled={fetchPreview.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {fetchPreview.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {fetchPreview.isPending
                    ? 'Loading preview...'
                    : 'Load email preview'}
                </Button>
              ) : (
                <ManualEmailPanel
                  preview={manualPreview}
                  onConfirm={handleManualConfirm}
                  isPending={confirmManual.isPending}
                />
              )
            }
            whatsappContent={
              !manualPreview ? (
                <Button
                  onClick={handleLoadManualPreview}
                  disabled={fetchPreview.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {fetchPreview.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <MailCheck data-icon="inline-start" />
                  )}
                  {fetchPreview.isPending
                    ? 'Loading preview...'
                    : 'Load WhatsApp message'}
                </Button>
              ) : (
                <WhatsAppMessagePanel
                  preview={manualPreview}
                  phoneNumber={activeWhatsappNumber}
                  onConfirm={handleManualConfirm}
                  isPending={confirmManual.isPending}
                />
              )
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LimitBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold">{value}</span>
    </div>
  )
}
