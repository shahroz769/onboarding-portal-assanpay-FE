import { useSyncExternalStore } from 'react'
import { useRouter } from '@tanstack/react-router'

import type { LoginResponse, User } from '#/types/auth'

export type AuthSnapshot = {
  accessToken: string | null
  user: User | null
}

export type AuthClient = ReturnType<typeof createAuthClient>

const emptyAuthSnapshot: AuthSnapshot = {
  accessToken: null,
  user: null,
}

export function createAuthClient(initialState: AuthSnapshot = emptyAuthSnapshot) {
  let snapshot = initialState
  const listeners = new Set<() => void>()

  const emitChange = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    getSnapshot() {
      return snapshot
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setSession(session: LoginResponse) {
      snapshot = {
        accessToken: session.accessToken,
        user: session.user,
      }
      emitChange()
    },
    clear() {
      snapshot = emptyAuthSnapshot
      emitChange()
    },
    isAuthenticated() {
      return Boolean(snapshot.accessToken && snapshot.user)
    },
  }
}

export function useAuth() {
  const router = useRouter()
  const auth = router.options.context.auth

  return useSyncExternalStore(
    auth.subscribe,
    auth.getSnapshot,
    auth.getSnapshot,
  )
}
