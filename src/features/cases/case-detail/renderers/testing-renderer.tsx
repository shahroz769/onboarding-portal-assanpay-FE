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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { FieldGroup } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { EmailModeChoice } from '#/components/case-email/email-mode-choice'
import { EmailRecipientSelect } from '#/components/case-email/email-recipient-select'
import { ManualEmailPanel } from '#/components/case-email/manual-email-panel'
import { WhatsAppMessagePanel } from '#/components/case-email/whatsapp-message-panel'
import { useAuth } from '#/features/auth/auth-client'
import {
  caseHistoryQueryOptions,
  useConfirmMidCreationEmailManual,
  useFetchMidCreationEmailPreview,
  useSendMidCreationEmail,
} from '#/hooks/use-case-detail-query'
import {
  emailSendingModeQueryOptions,
  limitsAndMdrQueryOptions,
} from '#/hooks/use-configuration-query'
import type { EmailPreviewResult } from '#/apis/cases'
import type { EmailRecipientType } from '#/schemas/cases.schema'

import type { QueueRendererProps } from '../queue-registry'

export default function TestingRenderer({
  caseDetail,
  caseId,
}: QueueRendererProps) {
  const { user } = useAuth()
  const emailModeQuery = useQuery(emailSendingModeQueryOptions())
  const limitsQuery = useQuery(limitsAndMdrQueryOptions())
  const historyQuery = useQuery(caseHistoryQueryOptions(caseId))
  const sendCredentialsEmail = useSendMidCreationEmail(caseId)
  const fetchPreview = useFetchMidCreationEmailPreview(caseId)
  const confirmManual = useConfirmMidCreationEmailManual(caseId)
  const emailMode = emailModeQuery.data ?? {
    autoEnabled: true,
    manualEnabled: true,
  }
  const limits = limitsQuery.data?.testing
  const paymentMethods = caseDetail.testing?.paymentMethods ?? []
  const payoutMethods = caseDetail.testing?.payoutMethods ?? []
  const limitsAppliedAt = caseDetail.testing?.limitsAppliedAt ?? null
  const limitsAppliedBy = caseDetail.testing?.limitsAppliedBy?.name ?? null
  const credentialsReady = Boolean(caseDetail.testing?.credentialsReady)
  const isCaseOwner = Boolean(
    caseDetail.owner && user?.id === caseDetail.owner.id,
  )
  const isWorking = caseDetail.case.status === 'working'
  const credentialsEmailSent = Boolean(
    historyQuery.data?.some(
      (entry) =>
        entry.action === 'mid_creation_email_sent' ||
        entry.action === 'mid_creation_email_sent_manual' ||
        entry.action === 'mid_creation_whatsapp_sent_manual',
    ),
  )
  const canSendCredentials =
    isCaseOwner &&
    isWorking &&
    credentialsReady &&
    Boolean(limitsAppliedAt) &&
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
  const [recipientEmailType, setRecipientEmailType] =
    useState<EmailRecipientType>('submitter')
  const submitterEmail =
    typeof caseDetail.merchant.submitterEmail === 'string'
      ? caseDetail.merchant.submitterEmail
      : null
  const businessEmail =
    typeof caseDetail.merchant.businessEmail === 'string'
      ? caseDetail.merchant.businessEmail
      : null

  function handleReview() {
    if (!canSendCredentials) return
    setManualPreview(null)
    setReviewOpen(true)
  }

  async function handleSendMail() {
    if (!canSendCredentials) return
    await sendCredentialsEmail.mutateAsync({ recipientEmailType })
    setManualPreview(null)
  }

  async function handleLoadManualPreview() {
    if (!canSendCredentials) return
    const data = await fetchPreview.mutateAsync({ recipientEmailType })
    setManualPreview(data)
  }

  async function handleManualConfirm(
    file: File,
    channel: 'email' | 'whatsapp',
  ) {
    if (!manualPreview) return
    await confirmManual.mutateAsync({
      tokenId: manualPreview.tokenId,
      file,
      channel,
      recipientEmailType,
    })
    if (channel === 'whatsapp') setReviewOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Testing Limits</CardTitle>
              <CardDescription>
                Testing limits must be applied from the dashboard before
                credentials can be sent.
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
            {paymentMethods.map((method) => (
              <LimitBlock
                key={method.id}
                label={`${method.label} collection`}
                value={`${method.testing.min.toLocaleString()}-${method.testing.max.toLocaleString()}`}
              />
            ))}
            {payoutMethods.length > 0 ? (
              payoutMethods.map((method) => (
                <LimitBlock
                  key={method.id}
                  label={`${method.label} payout`}
                  value={`${method.testing.min.toLocaleString()}-${method.testing.max.toLocaleString()}`}
                />
              ))
            ) : (
              <LimitBlock
                label="Disbursement"
                value={`${limits?.disbursementMin ?? 1000}-${limits?.disbursementMax ?? 50000}`}
              />
            )}
          </div>

          {limitsAppliedAt ? (
            <Alert variant="success">
              <CheckCircle2 />
              <AlertTitle>Limits have been applied</AlertTitle>
              <AlertDescription>
                Confirmed{limitsAppliedBy ? ` by ${limitsAppliedBy}` : ''}.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="warning">
              <Info />
              <AlertTitle>Limits have not been applied</AlertTitle>
              <AlertDescription>
                Apply limits for this portal MID from the dashboard before
                sending credentials.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>Send Credentials</CardTitle>
              <CardDescription>
                Send the saved merchant portal credentials and Go-Live link by
                auto Resend, manual Gmail, or WhatsApp.
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
            <Alert variant={credentialsReady ? 'success' : 'warning'}>
              <Info />
              <AlertTitle>
                {credentialsReady
                  ? 'Credentials ready'
                  : 'Credentials required'}
              </AlertTitle>
              <AlertDescription>
                {credentialsReady
                  ? 'Merchant portal credentials can be delivered by auto Resend, manual Gmail, or WhatsApp.'
                  : 'Save the portal MID and email in the MID Creation case before sending this mail.'}
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={handleReview}
                disabled={!canSendCredentials || sendCredentialsEmail.isPending}
              >
                <Mail data-icon="inline-start" />
                Send Credentials
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {!credentialsReady && isWorking ? (
        <Alert variant="warning">
          <Info />
          <AlertTitle>Portal credentials required</AlertTitle>
          <AlertDescription>
            Save the portal MID and email in the MID Creation case before
            sending credentials from Testing.
          </AlertDescription>
        </Alert>
      ) : credentialsReady && !limitsAppliedAt && isWorking ? (
        <Alert variant="warning">
          <Info />
          <AlertTitle>Limits have not been applied</AlertTitle>
          <AlertDescription>
            Apply limits from the dashboard before sending credentials to the
            client.
          </AlertDescription>
        </Alert>
      ) : credentialsEmailSent ? (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Credentials already sent</AlertTitle>
          <AlertDescription>
            Merchant portal credentials were sent for this Testing case. Mark as
            successful is now available.
          </AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send credentials</DialogTitle>
          </DialogHeader>

          <Alert>
            <MailCheck />
            <AlertTitle>Credentials stay hidden</AlertTitle>
            <AlertDescription>
              Send the saved merchant portal credentials and Go-Live link by
              auto Resend, manual Gmail, or WhatsApp. Manual Gmail and WhatsApp
              require a sent-message screenshot.
            </AlertDescription>
          </Alert>

          <EmailRecipientSelect
            value={recipientEmailType}
            onValueChange={(value) => {
              setRecipientEmailType(value)
              setManualPreview(null)
            }}
            submitterEmail={submitterEmail}
            businessEmail={businessEmail}
            disabled={
              sendCredentialsEmail.isPending ||
              fetchPreview.isPending ||
              confirmManual.isPending
            }
          />

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
                  onConfirm={(file) => handleManualConfirm(file, 'email')}
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
                  onConfirm={(file) => handleManualConfirm(file, 'whatsapp')}
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
