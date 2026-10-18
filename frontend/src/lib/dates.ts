// Weeks are ISO weeks (Mon–Sun) in Asia/Kuala_Lumpur (NFR-11), passed around as 'YYYY-MM-DD' Mondays.

const KL = 'Asia/Kuala_Lumpur'

/** Today's date in Malaysia as YYYY-MM-DD, whatever the phone's timezone. */
export function todayKL(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KL }).format(now)
}

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function addDays(iso: string, days: number): string {
  const d = utc(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function weekStart(iso: string): string {
  return addDays(iso, -((utc(iso).getUTCDay() + 6) % 7))
}

/** "13–19 Okt" / "27 Okt – 2 Nov" in the rider's language. */
export function weekLabel(monday: string, lang: 'ms' | 'en'): string {
  const fmt = (iso: string, month: boolean) =>
    new Intl.DateTimeFormat(lang === 'ms' ? 'ms-MY' : 'en-GB', { day: 'numeric', ...(month ? { month: 'short' } : {}), timeZone: 'UTC' }).format(utc(iso))
  const sunday = addDays(monday, 6)
  const sameMonth = monday.slice(5, 7) === sunday.slice(5, 7)
  return sameMonth ? `${fmt(monday, false)}–${fmt(sunday, true)}` : `${fmt(monday, true)} – ${fmt(sunday, true)}`
}
