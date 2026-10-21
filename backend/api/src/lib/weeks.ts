// Weeks are ISO weeks (Mon–Sun) in Asia/Kuala_Lumpur, passed around as 'YYYY-MM-DD' Mondays.
const KL = 'Asia/Kuala_Lumpur'
const DAY = 86_400_000

/** Today in Malaysia, whatever the server's timezone. Overridable in tests. */
export const clock = { now: () => new Date() }

export const todayKL = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: KL }).format(clock.now())

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const fmt = (d: Date) => d.toISOString().slice(0, 10)

export const addDays = (iso: string, days: number): string => fmt(new Date(utc(iso).getTime() + days * DAY))
export const addWeeks = (iso: string, weeks: number): string => addDays(iso, weeks * 7)
export const weekStart = (iso: string): string => addDays(iso, -((utc(iso).getUTCDay() + 6) % 7))
export const thisWeek = (): string => weekStart(todayKL())
export const isMonday = (iso: string): boolean => utc(iso).getUTCDay() === 1
export const weeksBetween = (a: string, b: string): number => Math.round((utc(b).getTime() - utc(a).getTime()) / (7 * DAY))

/** Midnight in Malaysia (UTC+8) of a KL date, as a real instant. */
export const klMidnight = (iso: string): Date => new Date(utc(iso).getTime() - 8 * 3_600_000)
