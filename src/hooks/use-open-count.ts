import { useState } from 'react'

// Counts closed → open transitions. Key a dialog's body with it so each open
// starts from fresh state while the Dialog root itself stays mounted — Base UI
// only runs the enter animation for a dialog that was mounted closed first.
export function useOpenCount(open: boolean): number {
  const [state, setState] = useState({ open, count: open ? 1 : 0 })

  if (open !== state.open) {
    setState({ open, count: open ? state.count + 1 : state.count })
  }

  return open && !state.open ? state.count + 1 : state.count
}
