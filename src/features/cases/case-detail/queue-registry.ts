import type { ComponentType } from 'react'
import { lazy } from 'react'

import type { CaseDetail } from '#/schemas/cases.schema'

export interface QueueRendererProps {
  caseDetail: CaseDetail
  caseId: string
}

type LazyQueueRenderer = ComponentType<QueueRendererProps>

const registry = {
  'documents-review': () => import('./renderers/documents-review-renderer'),
  'sub-merchant-form': () => import('./renderers/sub-merchant-form-renderer'),
  agreement: () => import('./renderers/agreement-renderer'),
  'merchant-id': () => import('./renderers/merchant-id-renderer'),
  testing: () => import('./renderers/testing-renderer'),
  live: () => import('./renderers/live-renderer'),
} satisfies Partial<
  Record<string, () => Promise<{ default: LazyQueueRenderer }>>
>

const loadedComponents = new Map<string, LazyQueueRenderer>()

export function getQueueRenderer(queueSlug: string): LazyQueueRenderer {
  if (loadedComponents.has(queueSlug)) {
    return loadedComponents.get(queueSlug)!
  }

  const loader = registry[queueSlug]
  if (!loader) {
    const FallbackRenderer = lazy(() => import('./renderers/fallback-renderer'))
    loadedComponents.set(queueSlug, FallbackRenderer)
    return FallbackRenderer
  }

  const LazyComponent = lazy(loader)
  loadedComponents.set(queueSlug, LazyComponent)
  return LazyComponent
}
