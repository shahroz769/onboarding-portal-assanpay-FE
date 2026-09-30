import { AxiosError } from 'axios'

export const NETWORK_ERROR_MESSAGE =
  'Unable to reach the server. Check your connection and try again.'

/** The message the API sent with a failed response, if any. */
export function getServerErrorMessage(error: unknown): string | null {
  if (!(error instanceof AxiosError)) return null
  const data = error.response?.data

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (data && typeof data === 'object') {
    const errorMessage =
      'error' in data && typeof data.error === 'string' ? data.error : null
    const message =
      'message' in data && typeof data.message === 'string'
        ? data.message
        : null
    const errors =
      'errors' in data && Array.isArray(data.errors)
        ? data.errors.filter(
            (value: unknown): value is string => typeof value === 'string',
          )
        : []

    return errorMessage ?? message ?? errors[0] ?? null
  }

  return null
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  const serverMessage = getServerErrorMessage(error)
  if (serverMessage) return serverMessage

  // A response body without a readable message gets the fallback, not the
  // generic Axios text.
  const data = error instanceof AxiosError ? error.response?.data : undefined
  if (data && typeof data === 'object') return fallback

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

/**
 * Copy for full-page error states: only messages the API wrote for people.
 * Code errors (a TypeError, "Request failed with status code 500") fall back
 * to the caller's copy, and a request that never got a response says so.
 */
export function getErrorStateMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError && !error.response) {
    return NETWORK_ERROR_MESSAGE
  }
  return getServerErrorMessage(error) ?? fallback
}
