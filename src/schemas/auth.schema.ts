import * as z from 'zod'

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(2, 'Enter your email or username')
    .max(255, 'Must be at most 255 characters'),
  password: z
    .string()
    .min(1, 'Enter your password')
    .max(128, 'Invalid username or password'),
})
