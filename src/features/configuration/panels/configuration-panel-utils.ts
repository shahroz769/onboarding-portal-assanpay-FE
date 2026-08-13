const MAX_DRAFT_BYTES = 5 * 1024 * 1024
const DRAFT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx'])

export function getValidationErrors(
  result:
    | { success: true }
    | {
        success: false
        error: {
          issues: Array<{
            path: PropertyKey[]
            message: string
          }>
        }
      },
) {
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    if (!errors[key]) errors[key] = issue.message
  }
  return errors
}

export function hasValidationErrors(errors: Record<string, string>) {
  return Object.keys(errors).length > 0
}

export function getDraftFileError(file: File | null) {
  if (!file) return null
  if (file.size > MAX_DRAFT_BYTES) {
    return 'Draft file must be 5 MB or smaller.'
  }
  const dotIndex = file.name.lastIndexOf('.')
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : ''
  if (!DRAFT_EXTENSIONS.has(extension)) {
    return 'Draft file must be a PDF, DOC, or DOCX file.'
  }
  return null
}
