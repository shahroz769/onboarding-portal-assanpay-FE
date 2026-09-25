import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

// Record ids are Postgres UUIDs; public link tokens are base64url strings
// (the API accepts 32-256 characters).
const uuidParamSchema = z.uuid()
const tokenParamSchema = z.string().regex(/^[\w-]{32,256}$/)

/**
 * Rejects malformed path params before any loader runs. Throwing notFound()
 * renders the route's notFoundComponent instead of requesting a record that
 * cannot exist.
 */
export function parseUuidParam(value: string) {
  if (!uuidParamSchema.safeParse(value).success) throw notFound()
  return value
}

export function parseTokenParam(value: string) {
  if (!tokenParamSchema.safeParse(value).success) throw notFound()
  return value
}
