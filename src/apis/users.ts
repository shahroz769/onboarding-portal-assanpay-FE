import { apiClient } from '#/lib/api-client'
import type {
  UserFormValues,
  UserListItem,
  UserRouteSearch,
} from '#/schemas/users.schema'

interface UsersResponse {
  users: UserListItem[]
}

export async function fetchUsers(
  params: Partial<UserRouteSearch> = {},
): Promise<UserListItem[]> {
  const response = await apiClient.get<UsersResponse>('/api/users', {
    params,
  })
  return response.data.users
}

export async function fetchUser(userId: string): Promise<UserListItem> {
  const response = await apiClient.get<{ user: UserListItem }>(
    `/api/users/${userId}`,
  )
  return response.data.user
}

export async function createUser(input: UserFormValues) {
  const response = await apiClient.post<{ user: UserListItem }>(
    '/api/users',
    input,
  )
  return response.data.user
}

export async function updateUser({
  userId,
  input,
}: {
  userId: string
  input: Omit<UserFormValues, 'email' | 'username'>
}) {
  const response = await apiClient.patch<{ user: UserListItem }>(
    `/api/users/${userId}`,
    input,
  )
  return response.data.user
}

export async function bulkUpdateUserStatus(input: {
  ids: string[]
  status: 'active' | 'inactive'
}) {
  const response = await apiClient.post<{ updated: number }>(
    '/api/users/bulk-status',
    input,
  )
  return response.data
}

export type BulkResetPasswordResult = {
  requested: number
  sent: number
  failed: number
  failedIds: string[]
}

export async function bulkSendUserResetPasswords(input: { ids: string[] }) {
  const response = await apiClient.post<BulkResetPasswordResult>(
    '/api/users/bulk-reset-password',
    input,
  )
  return response.data
}

export async function sendUserResetPassword(userId: string) {
  const response = await apiClient.post<{ success: true }>(
    `/api/users/${userId}/reset-password`,
  )
  return response.data
}
