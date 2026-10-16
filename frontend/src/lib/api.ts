import { queryOptions } from '@tanstack/react-query'

export type User = { id: string; email: string; displayName: string; avatarUrl: string | null; isDemo: boolean }

// Who am I: 401 means signed out (null), anything else unexpected is an error.
export const meQuery = queryOptions({
  queryKey: ['me'],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<User | null> => {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (res.status === 401) return null
    if (!res.ok) throw new Error(`GET /api/auth/me ${res.status}`)
    return ((await res.json()) as { user: User }).user
  },
})

export async function post(path: string): Promise<void> {
  const res = await fetch(path, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error(`POST ${path} ${res.status}`)
}
