import type { ReactNode } from 'react'

import { useState } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  ArrowRight,
  FileCheck2,
  GitBranch,
  Landmark,
  ListRestart,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'

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

import { Button } from '#/components/ui/button'

import { Spinner } from '#/components/ui/spinner'

import { Switch } from '#/components/ui/switch'

import {
  CASE_FLOW_CONFIGURATION_KEY,
  caseFlowConfigurationQueryOptions,
  isCaseFlowRevisionConflict,
  useEnqueueMissingCloseTriggerCasesMutation,
  usePreviewMissingCloseTriggerCasesMutation,
  useUpdateCaseFlowConfigurationMutation,
} from '#/hooks/use-configuration-query'

import type {
  CaseFlowCloseBlocker,
  CaseFlowCloseTrigger,
  CaseFlowConfiguration,
  CaseFlowCreationRequirement,
  CaseFlowStartRule,
} from '#/schemas/configuration.schema'

import { CaseFlowRulesSkeleton } from '../configuration-route-skeleton'
import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  QueueSelect,
} from './configuration-panel-shared'
import type { QueueOption } from './configuration-panel-shared'

// ─── Case Flow Rules ───────────────────────────────────────────────────────
export function CaseFlowRulesPanel() {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery(caseFlowConfigurationQueryOptions())
  const mutation = useUpdateCaseFlowConfigurationMutation()
  const previewBackfillMutation = usePreviewMissingCloseTriggerCasesMutation()
  const backfillMutation = useEnqueueMissingCloseTriggerCasesMutation()
  const [form, setForm] = useState<CaseFlowConfiguration | null>(null)
  const [staleRevisionOpen, setStaleRevisionOpen] = useState(false)
  const [reloadingStale, setReloadingStale] = useState(false)
  const [backfillTriggerId, setBackfillTriggerId] = useState<string | null>(
    null,
  )
  const value = form ?? data ?? null
  const queues = value?.queues ?? []
  const formError = value ? getCaseFlowFormError(value) : null
  if (isPending || !value) {
    return <CaseFlowRulesSkeleton />
  }
  function update(next: CaseFlowConfiguration) {
    setForm(next)
  }
  async function handleSave() {
    if (!value) return
    try {
      const savedConfiguration = await mutation.mutateAsync(value)
      setForm(savedConfiguration)
    } catch (error) {
      if (isCaseFlowRevisionConflict(error)) {
        setStaleRevisionOpen(true)
      }
    }
  }
  async function handleReloadStaleConfig() {
    setReloadingStale(true)
    await queryClient
      .invalidateQueries({
        queryKey: CASE_FLOW_CONFIGURATION_KEY,
      })
      .then(() => setStaleRevisionOpen(false))
      .finally(() => setReloadingStale(false))
  }
  function handleOpenBackfill(triggerId: string) {
    previewBackfillMutation.reset()
    backfillMutation.reset()
    setBackfillTriggerId(triggerId)
    previewBackfillMutation.mutate(triggerId)
  }
  async function handleBackfill() {
    if (!backfillTriggerId) return
    try {
      await backfillMutation.mutateAsync(backfillTriggerId)
      setBackfillTriggerId(null)
    } catch {
      // The mutation displays the API error and keeps the confirmation open.
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <ConfigurationSectionCard
        icon={Play}
        tone="emerald"
        title="First case after submission"
        description="When a merchant submits onboarding, automatically open these cases."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                ...value,
                startRules: [
                  ...value.startRules,
                  {
                    targetQueueId: '',
                    order: value.startRules.length + 1,
                    isActive: true,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add rule
          </Button>
        }
      >
        {value.startRules.length === 0 ? (
          <RuleListEmpty message="No first-case rules configured yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {value.startRules.map((rule, index) => (
              <StartRuleRow
                key={rule.id ?? `${rule.targetQueueId}-${rule.order}`}
                rule={rule}
                queues={queues}
                onChange={(nextRule) => {
                  const startRules = [...value.startRules]
                  startRules[index] = nextRule
                  update({ ...value, startRules })
                }}
                onRemove={() =>
                  update({
                    ...value,
                    startRules: value.startRules.filter((_, i) => i !== index),
                  })
                }
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      <ConfigurationSectionCard
        icon={GitBranch}
        tone="blue"
        title="Close triggers"
        description="When a case closes, automatically open another case for the same merchant."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                ...value,
                closeTriggers: [
                  ...value.closeTriggers,
                  {
                    sourceQueueId: '',
                    targetQueueId: '',
                    order: value.closeTriggers.length + 1,
                    isActive: true,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add trigger
          </Button>
        }
      >
        {value.closeTriggers.length === 0 ? (
          <RuleListEmpty message="No close triggers configured yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {value.closeTriggers.map((rule, index) => (
              <CloseTriggerRuleRow
                key={
                  rule.id ??
                  `${rule.sourceQueueId}-${rule.targetQueueId}-${rule.order}`
                }
                rule={rule}
                queues={queues}
                onChange={(nextRule) => {
                  const closeTriggers = [...value.closeTriggers]
                  closeTriggers[index] = nextRule
                  update({ ...value, closeTriggers })
                }}
                onRemove={() =>
                  update({
                    ...value,
                    closeTriggers: value.closeTriggers.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
                onBackfill={
                  rule.id && rule.isActive
                    ? () => handleOpenBackfill(rule.id!)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      <ConfigurationSectionCard
        icon={FileCheck2}
        tone="amber"
        title="Close requirements"
        description="Prevent a case from closing until another case has closed first."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                ...value,
                closeBlockers: [
                  ...value.closeBlockers,
                  {
                    blockedQueueId: '',
                    prerequisiteQueueId: '',
                    isActive: true,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add requirement
          </Button>
        }
      >
        {value.closeBlockers.length === 0 ? (
          <RuleListEmpty message="No close requirements configured yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {value.closeBlockers.map((rule, index) => (
              <CloseBlockerRuleRow
                key={
                  rule.id ??
                  `${rule.blockedQueueId}-${rule.prerequisiteQueueId}`
                }
                rule={rule}
                queues={queues}
                onChange={(nextRule) => {
                  const closeBlockers = [...value.closeBlockers]
                  closeBlockers[index] = nextRule
                  update({ ...value, closeBlockers })
                }}
                onRemove={() =>
                  update({
                    ...value,
                    closeBlockers: value.closeBlockers.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      <ConfigurationSectionCard
        icon={Landmark}
        tone="violet"
        title="Case creation requirements"
        description="Prevent creating a case until another case has closed successfully."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                ...value,
                creationRequirements: [
                  ...value.creationRequirements,
                  {
                    targetQueueId: '',
                    prerequisiteQueueId: '',
                    isActive: true,
                  },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add requirement
          </Button>
        }
      >
        {value.creationRequirements.length === 0 ? (
          <RuleListEmpty message="No case creation requirements configured yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {value.creationRequirements.map((rule, index) => (
              <CreationRequirementRow
                key={
                  rule.id ?? `${rule.targetQueueId}-${rule.prerequisiteQueueId}`
                }
                rule={rule}
                queues={queues}
                onChange={(nextRule) => {
                  const creationRequirements = [...value.creationRequirements]
                  creationRequirements[index] = nextRule
                  update({ ...value, creationRequirements })
                }}
                onRemove={() =>
                  update({
                    ...value,
                    creationRequirements: value.creationRequirements.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Fix the errors below</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <ConfigurationActionBar>
        <Button
          disabled={mutation.isPending || Boolean(formError)}
          onClick={() => void handleSave()}
        >
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save flow rules
        </Button>
      </ConfigurationActionBar>

      <AlertDialog open={staleRevisionOpen} onOpenChange={setStaleRevisionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Configuration was updated</AlertDialogTitle>
            <AlertDialogDescription>
              Someone else saved case flow rules while you were editing. Reload
              the latest configuration before making changes. Your unsaved edits
              will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              disabled={reloadingStale}
              onClick={(event) => {
                event.preventDefault()
                void handleReloadStaleConfig()
              }}
            >
              {reloadingStale ? <Spinner data-icon="inline-start" /> : null}
              {reloadingStale ? 'Reloading' : 'Reload configuration'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(backfillTriggerId)}
        onOpenChange={(open) => {
          if (!open && !backfillMutation.isPending) setBackfillTriggerId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create missing cases?</AlertDialogTitle>
            <AlertDialogDescription>
              This checks the saved close trigger and queues only merchants who
              have successfully closed the source case and have never had the
              target case.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {previewBackfillMutation.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Checking merchant case history…
            </div>
          ) : previewBackfillMutation.data ? (
            <Alert>
              <AlertTitle>
                {previewBackfillMutation.data.eligibleMerchantCount === 0
                  ? 'No missing cases'
                  : `${previewBackfillMutation.data.eligibleMerchantCount} merchant${previewBackfillMutation.data.eligibleMerchantCount === 1 ? '' : 's'} found`}
              </AlertTitle>
              <AlertDescription>
                {previewBackfillMutation.data.trigger.sourceQueueName} →{' '}
                {previewBackfillMutation.data.trigger.targetQueueName}
                {previewBackfillMutation.data.eligibleMerchantCount > 0
                  ? `. Never queued: ${previewBackfillMutation.data.jobBreakdown.neverQueued}; degraded and retrying automatically: ${previewBackfillMutation.data.jobBreakdown.failed}; still pending: ${previewBackfillMutation.data.jobBreakdown.pending}`
                  : ''}
                {previewBackfillMutation.data.sampleMerchants.length > 0
                  ? `. Includes ${previewBackfillMutation.data.sampleMerchants.map((merchant) => merchant.merchantName).join(', ')}${previewBackfillMutation.data.eligibleMerchantCount > previewBackfillMutation.data.sampleMerchants.length ? ', and others' : ''}.`
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

          <AlertDialogFooter>
            <AlertDialogCancel disabled={backfillMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                previewBackfillMutation.isPending ||
                !previewBackfillMutation.data ||
                previewBackfillMutation.data.eligibleMerchantCount === 0 ||
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
              {backfillMutation.isPending ? 'Queueing' : 'Create missing cases'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Sections & helpers ─────────────────────────────────────────────────────
function StartRuleRow({
  rule,
  queues,
  onChange,
  onRemove,
}: {
  rule: CaseFlowStartRule
  queues: QueueOption[]
  onChange: (rule: CaseFlowStartRule) => void
  onRemove: () => void
}) {
  return (
    <FlowRuleRow
      isActive={rule.isActive}
      onActiveChange={(isActive) => onChange({ ...rule, isActive })}
      onRemove={onRemove}
      fields={
        <div className="min-w-0 flex-1">
          <QueueSelect
            value={rule.targetQueueId}
            queues={queues}
            placeholder="Select first case to open"
            onValueChange={(targetQueueId) =>
              onChange({ ...rule, targetQueueId })
            }
          />
        </div>
      }
    />
  )
}

function CloseTriggerRuleRow({
  rule,
  queues,
  onChange,
  onRemove,
  onBackfill,
}: {
  rule: CaseFlowCloseTrigger
  queues: QueueOption[]
  onChange: (rule: CaseFlowCloseTrigger) => void
  onRemove: () => void
  onBackfill?: () => void
}) {
  return (
    <FlowRuleRow
      isActive={rule.isActive}
      onActiveChange={(isActive) => onChange({ ...rule, isActive })}
      onRemove={onRemove}
      onBackfill={onBackfill}
      fields={
        <FlowRuleRelation
          left={
            <QueueSelect
              value={rule.sourceQueueId}
              queues={queues}
              placeholder="When this case closes"
              onValueChange={(sourceQueueId) =>
                onChange({ ...rule, sourceQueueId })
              }
            />
          }
          right={
            <QueueSelect
              value={rule.targetQueueId}
              queues={queues}
              placeholder="Open this case"
              onValueChange={(targetQueueId) =>
                onChange({ ...rule, targetQueueId })
              }
            />
          }
        />
      }
    />
  )
}

function CloseBlockerRuleRow({
  rule,
  queues,
  onChange,
  onRemove,
}: {
  rule: CaseFlowCloseBlocker
  queues: QueueOption[]
  onChange: (rule: CaseFlowCloseBlocker) => void
  onRemove: () => void
}) {
  return (
    <FlowRuleRow
      isActive={rule.isActive}
      onActiveChange={(isActive) => onChange({ ...rule, isActive })}
      onRemove={onRemove}
      fields={
        <FlowRuleRelation
          left={
            <QueueSelect
              value={rule.blockedQueueId}
              queues={queues}
              placeholder="This case cannot close"
              onValueChange={(blockedQueueId) =>
                onChange({ ...rule, blockedQueueId })
              }
            />
          }
          right={
            <QueueSelect
              value={rule.prerequisiteQueueId}
              queues={queues}
              placeholder="Until this case closes"
              onValueChange={(prerequisiteQueueId) =>
                onChange({ ...rule, prerequisiteQueueId })
              }
            />
          }
        />
      }
    />
  )
}

function CreationRequirementRow({
  rule,
  queues,
  onChange,
  onRemove,
}: {
  rule: CaseFlowCreationRequirement
  queues: QueueOption[]
  onChange: (rule: CaseFlowCreationRequirement) => void
  onRemove: () => void
}) {
  return (
    <FlowRuleRow
      isActive={rule.isActive}
      onActiveChange={(isActive) => onChange({ ...rule, isActive })}
      onRemove={onRemove}
      fields={
        <FlowRuleRelation
          left={
            <QueueSelect
              value={rule.targetQueueId}
              queues={queues}
              placeholder="Before creating this case"
              onValueChange={(targetQueueId) =>
                onChange({ ...rule, targetQueueId })
              }
            />
          }
          right={
            <QueueSelect
              value={rule.prerequisiteQueueId}
              queues={queues}
              placeholder="Require this case closed"
              onValueChange={(prerequisiteQueueId) =>
                onChange({ ...rule, prerequisiteQueueId })
              }
            />
          }
        />
      }
    />
  )
}

function FlowRuleRelation({
  left,
  right,
}: {
  left: ReactNode
  right: ReactNode
}) {
  return (
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3">
      <div className="min-w-0">{left}</div>
      <ArrowRight
        className="hidden size-4 text-muted-foreground sm:block"
        aria-hidden
      />
      <div className="min-w-0">{right}</div>
    </div>
  )
}

function FlowRuleRow({
  fields,
  isActive,
  onActiveChange,
  onRemove,
  onBackfill,
}: {
  fields: ReactNode
  isActive: boolean
  onActiveChange: (isActive: boolean) => void
  onRemove: () => void
  onBackfill?: () => void
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-md border bg-background p-3 transition-colors hover:border-border/80 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center">{fields}</div>
      <div className="flex items-center justify-end gap-2 sm:gap-3">
        {onBackfill ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBackfill}
          >
            <ListRestart data-icon="inline-start" />
            Create missing
          </Button>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={isActive}
            onCheckedChange={onActiveChange}
            aria-label={isActive ? 'Deactivate rule' : 'Activate rule'}
          />
          <span className="inline-block w-12">
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove rule"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

function RuleListEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-8 text-center">
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        Click “Add” above to create one.
      </p>
    </div>
  )
}

function getCaseFlowFormError(value: CaseFlowConfiguration) {
  const requiredIds = [
    ...value.startRules.map((rule) => rule.targetQueueId),
    ...value.closeTriggers.flatMap((rule) => [
      rule.sourceQueueId,
      rule.targetQueueId,
    ]),
    ...value.closeBlockers.flatMap((rule) => [
      rule.blockedQueueId,
      rule.prerequisiteQueueId,
    ]),
    ...value.creationRequirements.flatMap((rule) => [
      rule.targetQueueId,
      rule.prerequisiteQueueId,
    ]),
  ]
  if (requiredIds.some((id) => !id)) return 'Select queues for every rule.'
  if (
    value.closeTriggers.some(
      (rule) => rule.sourceQueueId === rule.targetQueueId,
    )
  ) {
    return 'A queue cannot trigger itself.'
  }
  if (
    value.closeBlockers.some(
      (rule) => rule.blockedQueueId === rule.prerequisiteQueueId,
    )
  ) {
    return 'A queue cannot require itself before closing.'
  }
  if (hasDuplicateActiveRule(value.startRules, (rule) => rule.targetQueueId)) {
    return 'Each first-case queue can only be selected once.'
  }
  if (
    hasDuplicateActiveRule(
      value.closeTriggers,
      (rule) => `${rule.sourceQueueId}:${rule.targetQueueId}`,
    )
  ) {
    return 'Each close trigger relation can only be configured once.'
  }
  if (
    hasDuplicateActiveRule(
      value.closeBlockers,
      (rule) => `${rule.blockedQueueId}:${rule.prerequisiteQueueId}`,
    )
  ) {
    return 'Each close requirement relation can only be configured once.'
  }
  if (
    value.creationRequirements.some(
      (rule) => rule.targetQueueId === rule.prerequisiteQueueId,
    )
  ) {
    return 'A queue cannot require itself before creation.'
  }
  if (
    hasDuplicateActiveRule(
      value.creationRequirements,
      (rule) => `${rule.targetQueueId}:${rule.prerequisiteQueueId}`,
    )
  ) {
    return 'Each case creation requirement relation can only be configured once.'
  }
  return null
}

function hasDuplicateActiveRule<T extends { isActive: boolean }>(
  rules: T[],
  getKey: (rule: T) => string,
) {
  const keys = new Set<string>()
  for (const rule of rules) {
    if (!rule.isActive) continue
    const key = getKey(rule)
    if (keys.has(key)) return true
    keys.add(key)
  }
  return false
}
