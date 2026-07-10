import { z } from 'zod'

import { roleTypes } from '#/types/auth'

export { roleTypes }

export const USER_ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  agent: 'Agent',
} as const

export const USER_STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
} as const

export const USER_GENDER_LABELS = {
  male: 'Male',
  female: 'Female',
} as const

export const userStatuses = ['active', 'inactive'] as const
export const userGenders = ['male', 'female'] as const
export const queueViewScopes = ['all', 'selected'] as const
export const ASSANPAY_EMAIL_DOMAIN = '@assanpay.com'
export const ASSANPAY_EMAIL_MESSAGE = 'Email must use the @assanpay.com domain.'

export type UserStatus = (typeof userStatuses)[number]
export type UserGender = (typeof userGenders)[number]
export type QueueViewScope = (typeof queueViewScopes)[number]

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isAssanPayEmail(value: string) {
  return value.toLowerCase().endsWith(ASSANPAY_EMAIL_DOMAIN)
}

function createCsvEnumFilterSchema<const TValues extends readonly string[]>(
  values: TValues,
) {
  const allowedValues = new Set(values)

  return z
    .string()
    .optional()
    .transform(normalizeOptionalString)
    .refine(
      (value) =>
        value === undefined ||
        value.split(',').every((item) => allowedValues.has(item)),
      {
        message: 'Invalid filter value.',
      },
    )
}

export const userRouteSearchSchema = z.object({
  search: z.string().optional().transform(normalizeOptionalString),
  roleType: createCsvEnumFilterSchema(roleTypes),
  status: createCsvEnumFilterSchema(userStatuses),
})

export type UserRouteSearch = z.infer<typeof userRouteSearchSchema>

export const userQueueSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const userListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string(),
  gender: z.enum(userGenders),
  roleType: z.enum(roleTypes),
  status: z.enum(userStatuses),
  queueViewScope: z.enum(queueViewScopes),
  viewQueueIds: z.array(z.string()),
  workQueueIds: z.array(z.string()),
  viewQueues: z.array(userQueueSchema),
  workQueues: z.array(userQueueSchema),
  ownedCasesCount: z.number(),
  createdByUserId: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type UserListItem = z.infer<typeof userListItemSchema>

export const userListResponseSchema = z.object({
  users: z.array(userListItemSchema),
})

const queueAccessSchema = z
  .object({
    queueViewScope: z.enum(queueViewScopes),
    viewQueueIds: z.array(z.string()),
    workQueueIds: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    if (
      value.queueViewScope === 'selected' &&
      value.viewQueueIds.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['viewQueueIds'],
        message: 'Select at least one queue for view access.',
      })
    }

    const visible = new Set(value.viewQueueIds)
    if (
      value.queueViewScope === 'selected' &&
      value.workQueueIds.some((queueId) => !visible.has(queueId))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['workQueueIds'],
        message: 'Working access must be within view access.',
      })
    }
  })

export const userFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required').max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter a valid email')
      .max(255)
      .refine(isAssanPayEmail, ASSANPAY_EMAIL_MESSAGE),
    username: z.string().trim().min(2, 'Username is required').max(64),
    gender: z.enum(userGenders, { message: 'Select gender.' }),
    roleType: z.enum(roleTypes, { message: 'Select role.' }),
    status: z.enum(userStatuses),
    queueViewScope: z.enum(queueViewScopes),
    viewQueueIds: z.array(z.string()),
    workQueueIds: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    if (value.roleType !== 'agent') return

    const parsed = queueAccessSchema.safeParse(value)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        })
      }
    }
  })

export type UserFormValues = z.infer<typeof userFormSchema>

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

export type SetPasswordValues = z.infer<typeof setPasswordSchema>
