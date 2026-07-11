import type { ReactNode } from 'react'

import { useEffect, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import {
  ArrowRight,
  FileCheck2,
  GitBranch,
  Landmark,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'

import { Button } from '#/components/ui/button'

import { Spinner } from '#/components/ui/spinner'

import {
  caseFlowConfigurationQueryOptions,
  useUpdateCaseFlowConfigurationMutation,
} from '#/hooks/use-configuration-query'

import type {
  CaseFlowCloseBlocker,
  CaseFlowCloseTrigger,
  CaseFlowConfiguration,
  CaseFlowCreationRequirement,
  CaseFlowStartRule,
} from '#/schemas/configuration.schema'

import {
  ConfigurationActionBar,
  ConfigurationSectionCard,
  PanelLoading,
  QueueSelect,
} from './configuration-panel-shared'
import type { QueueOption } from './configuration-panel-shared'

// ─── Case Flow Rules ───────────────────────────────────────────────────────
export function CaseFlowRulesPanel() {
  const { data, isPending } = useQuery(caseFlowConfigurationQueryOptions())
  const mutation = useUpdateCaseFlowConfigurationMutation()
  const [form, setForm] = useState<CaseFlowConfiguration | null>(null)
  const value = form ?? data ?? null
  const queues = value?.queues ?? []
  const formError = value ? getCaseFlowFormError(value) : null
  useEffect(() => {
    if (data) setForm(data)
  }, [data])
  if (isPending || !value) {
    return <PanelLoading />
  }
  function update(next: CaseFlowConfiguration) {
    setForm(next)
  }
  return (
    <div className="flex flex-col gap-6">
      <ConfigurationSectionCard
        icon={Play}
        colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
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
                key={`start-${index}`}
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
        colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
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
                key={`trigger-${index}`}
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
              />
            ))}
          </div>
        )}
      </ConfigurationSectionCard>

      <ConfigurationSectionCard
        icon={FileCheck2}
        colorClass="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
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
                key={`blocker-${index}`}
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
        colorClass="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
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
                key={`creation-${index}`}
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
          onClick={() => mutation.mutate(getActiveCaseFlowConfiguration(value))}
        >
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save flow rules
        </Button>
      </ConfigurationActionBar>
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
}: {
  rule: CaseFlowCloseTrigger
  queues: QueueOption[]
  onChange: (rule: CaseFlowCloseTrigger) => void
  onRemove: () => void
}) {
  return (
    <FlowRuleRow
      onRemove={onRemove}
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
  onRemove,
}: {
  fields: ReactNode
  onRemove: () => void
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-md bg-muted/30 p-3 transition-colors sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center">{fields}</div>
      <div className="flex items-center justify-end gap-1 sm:gap-2">
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
  if (hasDuplicates(value.startRules.map((rule) => rule.targetQueueId))) {
    return 'Each first-case queue can only be selected once.'
  }
  if (
    hasDuplicates(
      value.closeTriggers.map(
        (rule) => `${rule.sourceQueueId}:${rule.targetQueueId}`,
      ),
    )
  ) {
    return 'Each close trigger relation can only be configured once.'
  }
  if (
    hasDuplicates(
      value.closeBlockers.map(
        (rule) => `${rule.blockedQueueId}:${rule.prerequisiteQueueId}`,
      ),
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
    hasDuplicates(
      value.creationRequirements.map(
        (rule) => `${rule.targetQueueId}:${rule.prerequisiteQueueId}`,
      ),
    )
  ) {
    return 'Each case creation requirement relation can only be configured once.'
  }
  return null
}

function getActiveCaseFlowConfiguration(
  value: CaseFlowConfiguration,
): CaseFlowConfiguration {
  return {
    ...value,
    startRules: value.startRules.map((rule) => ({ ...rule, isActive: true })),
    closeTriggers: value.closeTriggers.map((rule) => ({
      ...rule,
      isActive: true,
    })),
    closeBlockers: value.closeBlockers.map((rule) => ({
      ...rule,
      isActive: true,
    })),
    creationRequirements: value.creationRequirements.map((rule) => ({
      ...rule,
      isActive: true,
    })),
  }
}

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length
}
