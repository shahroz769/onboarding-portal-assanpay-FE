import { useState } from 'react'

import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

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
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import { Spinner } from '#/components/ui/spinner'
import type { PortalPasswordCode } from '#/apis/cases'
import {
  useGeneratePortalPasswordCode,
  useRevealPortalPasswordCode,
} from '#/hooks/use-case-detail-query'
import { useMorph } from '#/hooks/use-morph'
import type { CaseDetail } from '#/schemas/cases.schema'

import { CaseCardHeading } from './case-section'

type PortalPasswordCodeStatus = NonNullable<
  NonNullable<CaseDetail['testing']>['portalPasswordCode']
>

// Mirrors buildPortalPassword on the backend: the random code is the secret,
// the email prefix keeps the shape the merchant portal expects.
function buildPortalPassword(email: string, code: string) {
  const [localPart = email] = email.trim().split('@')
  return `${localPart.trim().toLowerCase()}@${code}`
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Karachi',
})

export function PortalPasswordCodeCard({
  caseId,
  status,
  email,
  canManage,
}: {
  caseId: string
  status: PortalPasswordCodeStatus | null
  /** Portal email being entered; falls back to the saved one. */
  email?: string | null
  /** Current owner of a working case. */
  canManage: boolean
}) {
  const revealCode = useRevealPortalPasswordCode(caseId)
  const generateCode = useGeneratePortalPasswordCode(caseId)
  const [revealed, setRevealed] = useState<PortalPasswordCode | null>(null)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  // The confirmation grows out of the Regenerate button.
  const regenerateMorph = useMorph()
  const isBusy = revealCode.isPending || generateCode.isPending
  const portalEmail = email?.trim() || revealed?.portalEmail || null
  const password =
    revealed && portalEmail
      ? buildPortalPassword(portalEmail, revealed.code)
      : null

  async function handleReveal() {
    setRevealed(await revealCode.mutateAsync())
  }

  async function handleGenerate() {
    setRevealed(await generateCode.mutateAsync())
    setRegenerateOpen(false)
  }

  async function handleCopy() {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      toast.success('Password copied')
    } catch {
      toast.error('Could not copy to the clipboard')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CaseCardHeading
          icon={KeyRound}
          tone="amber"
          title="Portal Password"
          description="A random one-time code makes up the merchant's temporary portal password. Set this password on the merchant portal, then send credentials from Testing."
          action={
            <Badge variant="secondary">
              <LockKeyhole />
              {status?.status === 'used'
                ? 'Sent'
                : status?.status === 'active'
                  ? 'Active'
                  : 'Not generated'}
            </Badge>
          }
        />
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {status?.status === 'used' ? (
            <Alert variant="success">
              <LockKeyhole />
              <AlertTitle>Code used</AlertTitle>
              <AlertDescription>
                Credentials were sent
                {status.consumedAt
                  ? ` on ${DATE_TIME_FORMATTER.format(new Date(status.consumedAt))}`
                  : ''}
                . The code has been cleared and can no longer be viewed.
              </AlertDescription>
            </Alert>
          ) : !canManage ? (
            <Alert variant="warning">
              <LockKeyhole />
              <AlertTitle>Owner only</AlertTitle>
              <AlertDescription>
                Only the current owner of a working case can view or generate
                the portal password code.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {revealed ? (
                <Field>
                  <FieldLabel htmlFor={`portal-password-${caseId}`}>
                    Temporary password
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`portal-password-${caseId}`}
                      readOnly
                      autoComplete="off"
                      className="font-mono"
                      value={password ?? `<email name>@${revealed.code}`}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        aria-label="Copy password"
                        disabled={!password}
                        onClick={() => void handleCopy()}
                      >
                        <Copy />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>
                    Code <span className="font-mono">{revealed.code}</span>,
                    generated{' '}
                    {DATE_TIME_FORMATTER.format(new Date(revealed.createdAt))}.
                    {password
                      ? ' The credentials email uses this exact password.'
                      : ' Enter the portal email to see the full password.'}
                  </FieldDescription>
                </Field>
              ) : status?.status === 'active' ? (
                <p className="text-sm text-muted-foreground">
                  A code was generated{' '}
                  {DATE_TIME_FORMATTER.format(new Date(status.createdAt))}.
                  Reveal it to set the password on the merchant portal. Every
                  reveal is recorded in the case history.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generate a code before creating the merchant account, then use
                  the resulting password on the merchant portal.
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {status?.status === 'active' ? (
                  <>
                    {revealed ? (
                      <Button
                        variant="outline"
                        onClick={() => setRevealed(null)}
                      >
                        <EyeOff data-icon="inline-start" />
                        Hide
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void handleReveal()}
                      >
                        {revealCode.isPending ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <Eye data-icon="inline-start" />
                        )}
                        Reveal
                      </Button>
                    )}
                    <AlertDialog
                      open={regenerateOpen}
                      onOpenChange={(next) => {
                        if (next) {
                          regenerateMorph.run(() => setRegenerateOpen(true))
                        } else {
                          setRegenerateOpen(false)
                        }
                      }}
                    >
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="outline"
                            disabled={isBusy}
                            {...regenerateMorph.triggerProps}
                          />
                        }
                      >
                        <RefreshCw data-icon="inline-start" />
                        Regenerate
                      </AlertDialogTrigger>
                      <AlertDialogContent {...regenerateMorph.popupProps}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Regenerate portal password code?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            The current code stops working. If the merchant
                            account already exists, update its password on the
                            merchant portal to the new one.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={generateCode.isPending}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            disabled={generateCode.isPending}
                            onClick={(event) => {
                              event.preventDefault()
                              void handleGenerate()
                            }}
                          >
                            {generateCode.isPending ? (
                              <Spinner data-icon="inline-start" />
                            ) : (
                              <RefreshCw data-icon="inline-start" />
                            )}
                            Regenerate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <Button
                    disabled={isBusy}
                    onClick={() => void handleGenerate()}
                  >
                    {generateCode.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <KeyRound data-icon="inline-start" />
                    )}
                    Generate code
                  </Button>
                )}
              </div>
            </>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
