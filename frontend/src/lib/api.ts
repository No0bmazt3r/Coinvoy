import { queryOptions } from '@tanstack/react-query'

export type Platform = 'grab' | 'foodpanda' | 'shopeefood' | 'lalamove' | 'other'
export type Risk = 'selamat' | 'berhati' | 'berisiko'

export type User = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  isDemo: boolean
  lang: 'ms' | 'en'
  theme: 'system' | 'light' | 'dark'
  city: string | null
  paydayWeekday: number | null
  defaultHours: number | null
  essentialsWeekSen: number | null
  pocketReady: boolean
  platforms: Platform[]
  onboarded: boolean
  consents: Partial<Record<'privacy' | 'llm_processing' | 'indeks_rider', { granted: boolean; version: string }>>
}

export type Factor = { key: 'first' | 'bills' | 'leave' | 'buffer' | 'forecast' | 'steady' | 'mixed'; deltaSen?: number; names?: string[] }

export type Salary = {
  weekStart: string
  salarySen: number
  pSafe: number
  risk: Risk
  factors: Factor[]
  band: { low: number; mid: number; high: number }
  buildUp: { targetSen: number; bufferSen: number; per100Sen: number } | null
  jurang: { essentialsSen: number; gapSen: number } | null
  coldStart: boolean
  weeksUsed: number
  plannedHours: number | null
  fromCutiSen: number
  billsThisWeekSen: number
  salaryDeltaSen: number | null
}

export type Transfer = {
  id: number
  weekStart: string
  direction: 'in' | 'out'
  amountSen: number
  allocation: Record<string, number>
  status: 'pending' | 'confirmed' | 'partial' | 'skipped'
  confirmedAmountSen: number | null
  confirmedAt: string | null
  verification: 'self' | 'checked'
}

export type Pot = { kind: string; balanceSen: number; targetSen: number; weeklySen: number }

export type Home = {
  salary: Salary | null
  transfer: Transfer | null
  buffer: Pot
  lastLoggedWeek: string | null
  needsSnap: boolean
  weeksLogged: number
}

export type Draft = {
  weekStart: string
  platform: Platform
  grossSen: number
  commissionSen: number
  incentivesSen: number
  tipsSen: number
  trips: number | null
  hoursOnline: number | null
  confidence?: 'high' | 'medium' | 'low'
  warnings?: string[]
  injectionSuspected?: boolean
}

export type Bill = {
  id: number
  name: string
  amountSen: number
  frequency: 'weekly' | 'monthly' | 'yearly' | 'once'
  dueDay: number | null
  dueDate: string | null
  active: boolean
}

/** Errors arrive as { error: { code, message_ms, message_en } } (architecture §10). */
export class ApiError extends Error {
  status: number
  code: string
  messageMs: string
  messageEn: string
  constructor(status: number, code: string, messageMs: string, messageEn: string) {
    super(messageEn)
    this.status = status
    this.code = code
    this.messageMs = messageMs
    this.messageEn = messageEn
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body || init.form ? 'POST' : 'GET'),
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(res.status, e?.code ?? 'network', e?.message_ms ?? 'Tak dapat sambung. Cuba lagi.', e?.message_en ?? "Couldn't connect. Try again.")
  }
  return data as T
}

export function errorText(error: unknown, lang: 'ms' | 'en', fallback: string): string {
  return error instanceof ApiError ? (lang === 'ms' ? error.messageMs : error.messageEn) : fallback
}

// Who am I: 401 means signed out (null), anything else unexpected is an error.
export const meQuery = queryOptions({
  queryKey: ['me'],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<User | null> => {
    try {
      return (await api<{ user: User }>('/api/auth/me')).user
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  },
})

export const homeQuery = queryOptions({ queryKey: ['home'], queryFn: () => api<Home>('/api/home') })
export const potsQuery = queryOptions({ queryKey: ['pots'], queryFn: async () => (await api<{ pots: Pot[] }>('/api/pots')).pots })
export const billsQuery = queryOptions({ queryKey: ['bills'], queryFn: async () => (await api<{ bills: Bill[] }>('/api/bills')).bills })

export async function post(path: string): Promise<void> {
  await api(path, { method: 'POST' })
}
