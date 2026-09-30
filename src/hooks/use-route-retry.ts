import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Retry for a route error: pages fetch their own data, so a failed query has
 * to be reset for the retry to request it again (invalidate only re-runs
 * loaders and clears the error boundary).
 */
export function useRouteRetry() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return () => {
    void queryClient.resetQueries({
      predicate: (query) => query.state.status === 'error',
    })
    void router.invalidate()
  }
}
