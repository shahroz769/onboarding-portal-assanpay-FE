import { createContext, useContext } from 'react'

export const PageHeaderActionsContext = createContext<HTMLElement | null>(null)

export function usePageHeaderActions() {
  return useContext(PageHeaderActionsContext)
}
