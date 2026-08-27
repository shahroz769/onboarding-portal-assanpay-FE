import type { CaseFlowConfiguration } from '#/schemas/configuration.schema'

/**
 * Save-time validation, ported 1:1 from the previous list editor
 * (`getCaseFlowFormError`) so the builder enforces identical rules.
 */
export function getWorkflowFormError(value: CaseFlowConfiguration) {
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
