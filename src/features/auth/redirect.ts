export function sanitizeRedirect(redirectTo?: string) {
  if (!redirectTo) {
    return '/'
  }

  if (!redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return '/'
  }

  return redirectTo
}
