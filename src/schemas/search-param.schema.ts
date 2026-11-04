import * as z from 'zod'

/**
 * A free-text `search` URL param. The router parses URL values as JSON, so a
 * hand-typed `?search=390` arrives as a number, not a string. Anything else
 * that isn't text is dropped rather than failing the whole route.
 */
export const searchParamSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    const trimmed = value === undefined ? '' : String(value).trim()
    return trimmed ? trimmed : undefined
  })
  .catch(undefined)
