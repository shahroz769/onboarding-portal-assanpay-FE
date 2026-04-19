import { apiClient } from '#/lib/api-client'
import type { User } from '#/types/auth'

// ─── List Users ─────────────────────────────────────────────────────────────

interface UsersResponse {
  users: User[]
}

export async function fetchUsers(): Promise<User[]> {
  const response = await apiClient.get<UsersResponse>('/api/users')
  return response.data.users
}
