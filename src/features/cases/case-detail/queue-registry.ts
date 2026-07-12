import type { ComponentType } from 'react'
import { lazy } from 'react'

import type { CaseDetail, QueueWorkflowType } from '#/schemas/cases.schema'

export interface QueueRendererProps {
  caseDetail: CaseDetail
  caseId: string
}

type LazyQueueRenderer = ComponentType<QueueRendererProps>
type QueueRendererLoader = () => Promise<{ default: LazyQueueRenderer }>

const registry: Record<QueueWorkflowType, QueueRendererLoader> = {
  document_review: () => import('./renderers/documents-review-renderer'),
  sub_merchant_form: () => import('./renderers/sub-merchant-form-renderer'),
  agreement: () => import('./renderers/agreement-renderer'),
  mid: () => import('./renderers/merchant-id-renderer'),
  testing: () => import('./renderers/testing-renderer'),
  wordpress: () => import('./renderers/wordpress-website-renderer'),
  card: () => import('./renderers/dialogpay-card-renderer'),
  physical_agreement: () => import('./renderers/physical-agreement-renderer'),
  live: () => import('./renderers/live-renderer'),
  generic: () => import('./renderers/generic-renderer'),
}

/** Temporary slug → workflowType bridge while older payloads lack workflowType. */
const legacySlugWorkflowMap: Record<string, QueueWorkflowType> = {
  'documents-review': 'document_review',
  'sub-merchant-form': 'sub_merchant_form',
  agreement: 'agreement',
  'merchant-id': 'mid',
  testing: 'testing',
  'wordpress-website': 'wordpress',
  'dialogpay-card': 'card',
  'physical-agreement': 'physical_agreement',
  live: 'live',
}

const QUEUE_WORKFLOW_TYPE_SET = new Set<string>([
  'generic',
  'document_review',
  'agreement',
  'mid',
  'testing',
  'wordpress',
  'card',
  'physical_agreement',
  'live',
  'sub_merchant_form',
])

const loadedComponents = new Map<string, LazyQueueRenderer>()

export function resolveQueueWorkflowType(queue: {
  workflowType?: QueueWorkflowType | null
  slug?: string | null
}): QueueWorkflowType {
  if (queue.workflowType && QUEUE_WORKFLOW_TYPE_SET.has(queue.workflowType)) {
    return queue.workflowType
  }
  if (queue.slug && Object.hasOwn(legacySlugWorkflowMap, queue.slug)) {
    return legacySlugWorkflowMap[queue.slug]
  }
  return 'generic'
}

export async function preloadQueueRenderer(workflowTypeOrSlug: string) {
  const workflowType = resolveQueueWorkflowType({
    workflowType: QUEUE_WORKFLOW_TYPE_SET.has(workflowTypeOrSlug)
      ? (workflowTypeOrSlug as QueueWorkflowType)
      : undefined,
    slug: workflowTypeOrSlug,
  })
  await registry[workflowType]()
}

export function getQueueRenderer(
  workflowTypeOrSlug: string,
): LazyQueueRenderer {
  const workflowType = resolveQueueWorkflowType({
    workflowType: QUEUE_WORKFLOW_TYPE_SET.has(workflowTypeOrSlug)
      ? (workflowTypeOrSlug as QueueWorkflowType)
      : undefined,
    slug: workflowTypeOrSlug,
  })

  const cached = loadedComponents.get(workflowType)
  if (cached) return cached

  const LazyComponent = lazy(registry[workflowType])
  loadedComponents.set(workflowType, LazyComponent)
  return LazyComponent
}
