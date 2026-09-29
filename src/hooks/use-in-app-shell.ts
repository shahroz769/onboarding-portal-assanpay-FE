import { createContext, useContext } from 'react'

/** True below the signed-in app shell, which already renders the page's <main>. */
export const InAppShellContext = createContext(false)

export function useInAppShell() {
  return useContext(InAppShellContext)
}
