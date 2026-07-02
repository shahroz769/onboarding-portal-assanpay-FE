import { z } from 'zod'

const LOCAL_API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const CLOUDFLARE_API_BASE_URL = 'https://onboard.assanpay.net'

const apiBaseUrlSchema = z
  .string()
  .trim()
  .url()
  .transform((url) => url.replace(/\/+$/, ''))

export const API_BASE_URL = apiBaseUrlSchema.parse(
  import.meta.env.DEV ? LOCAL_API_BASE_URL : CLOUDFLARE_API_BASE_URL,
)
