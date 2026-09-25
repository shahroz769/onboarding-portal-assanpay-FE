import { useState } from 'react'

// Keeps the last non-null value while the live value is null. Dialogs driven
// by a nullable target stay mounted with their content through the exit
// animation instead of unmounting the moment the target is cleared.
export function useRetainedValue<T>(value: T | null): T | null {
  const [retained, setRetained] = useState(value)

  if (value !== null && value !== retained) {
    setRetained(value)
  }

  return value ?? retained
}
