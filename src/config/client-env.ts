import { z } from 'zod'

const API_BASE_URL_FALLBACK = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://onboard.assanpay.net'

const apiBaseUrlSchema = z
  .string()
  .trim()
  .url()
  .transform((url) => url.replace(/\/+$/, ''))

export const API_BASE_URL = apiBaseUrlSchema.parse(
  import.meta.env.VITE_API_URL ?? API_BASE_URL_FALLBACK,
)
