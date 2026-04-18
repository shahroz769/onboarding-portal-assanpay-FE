import { QueryClient } from '@tanstack/react-query'

import { createAuthClient } from '#/features/auth/auth-client'
import { setApiClientAuth } from '#/lib/api-client'

export function getContext() {
  const queryClient = new QueryClient()
  const auth = createAuthClient()

  setApiClientAuth(auth)

  return {
    queryClient,
    auth,
  }
}
