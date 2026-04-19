import type { ComponentType } from 'react'
import { lazy } from 'react'

import type { CaseDetail } from '#/schemas/cases.schema'

export interface QueueRendererProps {
  caseDetail: CaseDetail
  caseId: string
}

type LazyQueueRenderer = ComponentType<QueueRendererProps>

const registry: Record<string, () => Promise<{ default: LazyQueueRenderer }>> =
  {
    'documents-review': () =>
      import('./renderers/documents-review-renderer'),
  }

const loadedComponents = new Map<string, LazyQueueRenderer>()

export function getQueueRenderer(queueSlug: string): LazyQueueRenderer {
  if (loadedComponents.has(queueSlug)) {
    return loadedComponents.get(queueSlug)!
  }

  const loader = registry[queueSlug]
  if (!loader) {
    const FallbackRenderer = lazy(() =>
      import('./renderers/fallback-renderer'),
    )
    loadedComponents.set(queueSlug, FallbackRenderer)
    return FallbackRenderer
  }

  const LazyComponent = lazy(loader)
  loadedComponents.set(queueSlug, LazyComponent)
  return LazyComponent
}
