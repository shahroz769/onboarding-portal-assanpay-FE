export const roleTypes = ['super_admin', 'admin', 'agent'] as const

export type RoleType = (typeof roleTypes)[number]

export type User = {
  id: string
  name: string
  email: string
  username: string
  gender: 'male' | 'female'
  roleType: RoleType
  status: 'active' | 'inactive'
  queueViewScope: 'all' | 'selected'
  createdByUserId: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type LoginResponse = {
  accessToken: string
  user: User
}

export type RefreshResponse = {
  accessToken: string
  user: User
}
