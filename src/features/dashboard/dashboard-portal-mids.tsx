import { useMemo, useState } from 'react'

import {
  CheckCircle2,
  ClipboardCopy,
  Eye,
  ListChecks,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { useAuth } from '#/features/auth/auth-client'
import { useApplyPortalMidLimits } from '#/hooks/use-dashboard-query'
import type { DashboardResponse } from '#/schemas/dashboard.schema'

const pastedMidsSchema = z
  .array(z.number().int().positive())
  .min(1, 'Paste at least one portal MID.')

export function DashboardPortalMids({ data }: { data: DashboardResponse }) {
  const { user } = useAuth()
  const applyLimits = useApplyPortalMidLimits()
  const pending = data.portalMids.pendingLimits
  const csv = data.portalMids.csv
  const appliedCsv = data.portalMids.appliedCsv
  const appliedCount = data.portalMids.appliedLimits.length
  const canApply = user?.roleType === 'admin' || user?.roleType === 'supervisor'
  const [open, setOpen] = useState(false)
  const [appliedOpen, setAppliedOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const parsedPortalMids = useMemo(() => parsePortalMids(value), [value])

  async function handleCopy() {
    if (!csv) return
    await navigator.clipboard.writeText(csv)
    toast.success('Portal MIDs copied')
  }

  async function handleCopyApplied() {
    if (!appliedCsv) return
    await navigator.clipboard.writeText(appliedCsv)
    toast.success('Applied portal MIDs copied')
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValue('')
      setError(null)
    }
  }

  async function handleSave() {
    if (parsedPortalMids.error) {
      setError(parsedPortalMids.error)
      return
    }

    const result = pastedMidsSchema.safeParse(parsedPortalMids.portalMids)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Enter valid portal MIDs.')
      return
    }

    setError(null)
    await applyLimits.mutateAsync({ portalMids: result.data })
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>Portal MIDs awaiting limits</CardTitle>
            <CardDescription>
              Successful MID Creation cases pending Portal MID and internal MID
              limits.
            </CardDescription>
          </div>
          <Badge variant={pending.length > 0 ? 'outline' : 'secondary'}>
            {pending.length > 0 ? <ListChecks /> : <CheckCircle2 />}
            {pending.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pending.length > 0 ? (
          <>
            <div className="rounded-md border bg-muted/20 px-3 py-3">
              <p className="wrap-break-word font-mono text-sm">{csv}</p>
            </div>
            <ScrollArea className="max-h-72">
              <div className="flex flex-col gap-2 pr-3">
                {pending.map((item) => (
                  <div
                    key={`${item.caseId}-${item.midKind}-${item.portalMid}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.merchantName}</p>
                      <p className="text-muted-foreground">
                        {item.caseNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {item.midKind === 'internal'
                          ? 'Portal MID (Internal)'
                          : 'Portal MID'}
                      </Badge>
                      <span className="font-mono font-semibold">
                        {item.portalMid}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <ClipboardCopy data-icon="inline-start" />
                Copy
              </Button>
              <Button variant="outline" onClick={() => setAppliedOpen(true)}>
                <Eye data-icon="inline-start" />
                Applied Previously
              </Button>
              <Button
                onClick={() => handleOpenChange(true)}
                disabled={!canApply}
              >
                <ShieldCheck data-icon="inline-start" />
                Apply Limits
              </Button>
            </div>
            {!canApply ? (
              <Alert>
                <ShieldCheck />
                <AlertTitle>Admin or supervisor required</AlertTitle>
                <AlertDescription>
                  Only admins and supervisors can mark portal MID limits as
                  applied.
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        ) : (
          <>
            <Alert>
              <CheckCircle2 />
              <AlertTitle>All eligible portal MIDs are complete</AlertTitle>
              <AlertDescription>
                There are no successful MID Creation cases waiting for testing
                or internal limit application. You can still pre-apply limits
                for MIDs before onboarding.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setAppliedOpen(true)}>
                <Eye data-icon="inline-start" />
                Applied Previously
              </Button>
              <Button
                onClick={() => handleOpenChange(true)}
                disabled={!canApply}
              >
                <ShieldCheck data-icon="inline-start" />
                Apply Limits
              </Button>
            </div>
            {!canApply ? (
              <Alert>
                <ShieldCheck />
                <AlertTitle>Admin or supervisor required</AlertTitle>
                <AlertDescription>
                  Only admins and supervisors can mark portal MID limits as
                  applied or pre-applied.
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
      </CardContent>

      <Dialog open={appliedOpen} onOpenChange={setAppliedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Applied portal MIDs</DialogTitle>
            <DialogDescription>
              Portal MIDs whose limits have already been saved.
            </DialogDescription>
          </DialogHeader>

          {appliedCount > 0 ? (
            <div className="rounded-md border bg-muted/20 px-3 py-3">
              <p className="wrap-break-word font-mono text-sm">{appliedCsv}</p>
            </div>
          ) : (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>No applied portal MIDs</AlertTitle>
              <AlertDescription>
                No portal MIDs have been saved as applied yet.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAppliedOpen(false)}>
              Close
            </Button>
            <Button onClick={handleCopyApplied} disabled={appliedCount === 0}>
              <ClipboardCopy data-icon="inline-start" />
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply limits</DialogTitle>
            <DialogDescription>
              Paste portal MIDs after applying testing limits in the portal, or
              paste internal MIDs after applying live limits. You can also add
              MIDs in advance before onboarding.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="portal-mids">Portal MIDs</FieldLabel>
              <Textarea
                id="portal-mids"
                value={value}
                aria-invalid={Boolean(error)}
                className="min-h-32 font-mono"
                placeholder="1,2,5,8,9001,9002"
                disabled={applyLimits.isPending}
                onChange={(event) => {
                  setValue(event.target.value)
                  if (error) setError(null)
                }}
              />
              <FieldDescription>
                Enter comma-separated MIDs. Saved dashboard lists are shown
                without spaces.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={applyLimits.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={applyLimits.isPending}>
              {applyLimits.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ShieldCheck data-icon="inline-start" />
              )}
              {applyLimits.isPending ? 'Saving' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

const portalMidRangePattern = /(\d+)\s*-\s*(\d+)/g

function parsePortalMids(value: string): {
  portalMids: number[]
  error: string | null
} {
  const mids: number[] = []
  let remaining = value.replace(/\bup\s*to\b/gi, '-')
  remaining = remaining.replace(/\bupto\b/gi, '-')
  remaining = remaining.replace(/\bto\b/gi, '-')

  const hasDescendingRange = Array.from(
    remaining.matchAll(portalMidRangePattern),
  ).some(([, startValue, endValue]) => Number(startValue) > Number(endValue))

  if (hasDescendingRange) {
    return {
      portalMids: [],
      error: 'MID ranges must go from the smaller number to the larger number.',
    }
  }

  remaining = remaining.replace(
    portalMidRangePattern,
    (match, startValue: string, endValue: string) => {
      const start = Number(startValue)
      const end = Number(endValue)

      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        return match
      }

      for (let mid = start; mid <= end; mid += 1) {
        mids.push(mid)
      }

      return ' '
    },
  )

  const standaloneMids = remaining
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)

  mids.push(...standaloneMids)

  if (mids.some((mid) => !Number.isSafeInteger(mid) || mid <= 0)) {
    return {
      portalMids: [],
      error: 'Enter only positive whole-number portal MIDs.',
    }
  }

  if (/\d+\s*-\s*\d+/.test(remaining)) {
    return {
      portalMids: [],
      error: 'MID ranges must go from the smaller number to the larger number.',
    }
  }

  return {
    portalMids: Array.from(new Set(mids)).sort((a, b) => a - b),
    error: null,
  }
}
