import { useState } from 'react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { DataTable } from '#/components/data-table'
import type { DataTableColumnDef } from '#/components/data-table'
import { EmptyState } from '#/components/empty-state'
import { useAuth } from '#/features/auth/auth-client'
import { useApplyPortalMidLimits } from '#/hooks/use-dashboard-query'
import type {
  ApplyPortalMidLimitsInput,
  DashboardPendingPortalMidLimit,
  DashboardResponse,
} from '#/schemas/dashboard.schema'

const pastedMidsSchema = z
  .array(z.number().int().positive())
  .min(1, 'Paste at least one portal MID.')

const pendingMidColumns: DataTableColumnDef<DashboardPendingPortalMidLimit>[] =
  [
    {
      id: 'merchant',
      header: 'Merchant',
      cell: (item) => (
        <div className="flex flex-col leading-tight whitespace-normal">
          <span className="font-medium">{item.merchantName}</span>
          <span className="text-xs text-muted-foreground">
            {item.subMerchantName ?? 'Sub-merchant not selected'}
          </span>
        </div>
      ),
    },
    {
      id: 'midKind',
      header: 'MID type',
      width: 110,
      cell: (item) => (
        <Badge variant={item.midKind === 'internal' ? 'secondary' : 'outline'}>
          {item.midKind === 'internal' ? 'Internal' : 'Standard'}
        </Badge>
      ),
    },
    {
      id: 'portalMid',
      header: <span className="block text-right">Portal MID</span>,
      width: 130,
      cell: (item) => (
        <span className="block text-right font-mono font-medium tabular-nums">
          {item.portalMid}
        </span>
      ),
    },
  ]

export function DashboardPortalMids({ data }: { data: DashboardResponse }) {
  const { user } = useAuth()
  const applyLimits = useApplyPortalMidLimits()
  const pending = data.portalMids.pendingLimits
  const appliedCsv = data.portalMids.appliedCsv
  const appliedLimits = data.portalMids.appliedLimits
  const appliedCount = data.portalMids.appliedLimits.length
  const appliedGroups = {
    customWordpress: appliedLimits.filter(
      (item) => item.category === 'custom_wordpress',
    ),
    shopify: appliedLimits.filter((item) => item.category === 'shopify'),
    internal: appliedLimits.filter((item) => item.category === 'internal'),
  }

  const canApply =
    user?.roleType === 'super_admin' || user?.roleType === 'admin'
  const [open, setOpen] = useState(false)
  const [appliedOpen, setAppliedOpen] = useState(false)
  const [value, setValue] = useState('')
  const [category, setCategory] =
    useState<ApplyPortalMidLimitsInput['category']>('custom_wordpress')
  const [error, setError] = useState<string | null>(null)
  const parsedPortalMids = parsePortalMids(value)

  async function handleCopyApplied() {
    if (!appliedCsv) return
    await navigator.clipboard.writeText(appliedCsv)
    toast.success('Applied portal MIDs copied')
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setValue('')
      setCategory('custom_wordpress')
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
    await applyLimits.mutateAsync({
      portalMids: result.data,
      category,
    })
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <CardTitle>Portal MIDs awaiting limits</CardTitle>
              <Badge variant={pending.length > 0 ? 'outline' : 'secondary'}>
                {pending.length > 0 ? <ListChecks /> : <CheckCircle2 />}
                {pending.length}
              </Badge>
            </div>
            <CardDescription>
              Successful MID Creation cases pending Portal MID and internal MID
              limits.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setAppliedOpen(true)}>
              <Eye data-icon="inline-start" />
              Applied Previously
            </Button>
            <Button onClick={() => handleOpenChange(true)} disabled={!canApply}>
              <ShieldCheck data-icon="inline-start" />
              Apply Limits
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DataTable
          columns={pendingMidColumns}
          data={pending}
          getRowId={(item) =>
            `${item.caseId}-${item.midKind}-${item.portalMid}`
          }
          className="h-auto max-h-72"
          emptyContent={
            <EmptyState
              icon={CheckCircle2}
              tone="success"
              title="All eligible portal MIDs are complete"
              description="No successful MID Creation cases are waiting for testing or limit application. You can still pre-apply limits for MIDs before onboarding."
            />
          }
        />
        {!canApply ? (
          <Alert variant="warning">
            <ShieldCheck />
            <AlertTitle>Super Admin or Admin required</AlertTitle>
            <AlertDescription>
              Only Super Admins and Admins can mark portal MID limits as applied
              or pre-applied.
            </AlertDescription>
          </Alert>
        ) : null}
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
            <ScrollArea viewportClassName="max-h-[60vh]">
              <div className="flex flex-col gap-4 pr-3">
                <AppliedMidSection
                  title="Custom/WordPress"
                  mids={appliedGroups.customWordpress.map(
                    (item) => item.portalMid,
                  )}
                />

                <AppliedMidSection
                  title="Shopify"
                  mids={appliedGroups.shopify.map((item) => item.portalMid)}
                />

                <AppliedMidSection
                  title="Internal"
                  mids={appliedGroups.internal.map((item) => item.portalMid)}
                />
              </div>
            </ScrollArea>
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
              Select the MID category, then paste the MIDs whose limits have
              been applied. You can also add MIDs in advance before onboarding.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="portal-mid-category">Category</FieldLabel>
              <Select
                items={[
                  { value: 'custom_wordpress', label: 'Custom/WordPress' },
                  { value: 'shopify', label: 'Shopify' },
                  { value: 'internal', label: 'Internal' },
                ]}
                value={category}
                disabled={applyLimits.isPending}
                onValueChange={(nextCategory) =>
                  setCategory(
                    nextCategory as ApplyPortalMidLimitsInput['category'],
                  )
                }
              >
                <SelectTrigger id="portal-mid-category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom_wordpress">
                    Custom/WordPress
                  </SelectItem>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Saved MIDs appear under this section in Applied Previously.
              </FieldDescription>
            </Field>
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

function AppliedMidSection({ title, mids }: { title: string; mids: number[] }) {
  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <Badge variant="outline">{mids.length}</Badge>
      </div>
      {mids.length > 0 ? (
        <p className="wrap-break-word font-mono text-sm">{mids.join(',')}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No applied MIDs.</p>
      )}
    </section>
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
