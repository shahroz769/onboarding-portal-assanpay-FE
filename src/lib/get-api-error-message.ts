import { AxiosError } from 'axios'

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  if (error instanceof AxiosError) {
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

      return errorMessage ?? message ?? errors[0] ?? fallback
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
