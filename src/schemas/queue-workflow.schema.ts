/**
 * Mirrors BE `src/contracts/queues.ts` (plans 003–004).
 * Keep these unions in sync when backend contracts change.
 */
export const QUEUE_WORKFLOW_TYPES = [
  'generic',
  'document_review',
  'agreement',
  'mid',
  'testing',
  'wordpress',
  'card',
  'live',
  'sub_merchant_form',
] as const

export type QueueWorkflowType = (typeof QUEUE_WORKFLOW_TYPES)[number]

export const QUEUE_LIFECYCLES = ['draft', 'active', 'inactive'] as const

export type QueueLifecycle = (typeof QUEUE_LIFECYCLES)[number]
