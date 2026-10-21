// The payday reminder: a Web Push on the rider's payday, morning in Malaysia; tapping it opens Snap.
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import webpush from 'web-push'
import { db, schema } from '../db/index.ts'
import { env, pushConfigured } from '../env.ts'
import { errorFields, log } from '../log.ts'
import { clock, thisWeek, todayKL } from '../lib/weeks.ts'

const REMINDER_HOUR = 9 // KL time; the reminder goes out on the first check after this
const COPY = {
  ms: { title: 'Hari gaji!', body: 'Snap pendapatan minggu lepas untuk gaji minggu ini.' },
  en: { title: 'Payday!', body: "Snap last week's earnings to get this week's salary." },
}

type Sub = typeof schema.pushSubscriptions.$inferSelect

/** Sends one notification; a subscription the browser has dropped (404/410) is deleted. */
export async function sendPush(sub: Sub, payload: object): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
      TTL: 12 * 3600,
    })
    return true
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id))
    else log('warn', 'push failed', { status, ...errorFields(err) })
    return false
  }
}

export const reminderPayload = (lang: string) => ({ ...(lang === 'en' ? COPY.en : COPY.ms), url: '/snap' })

/** KL weekday with 0 = Monday (users.paydayWeekday) and the KL hour. */
function klNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(clock.now())
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.find((p) => p.type === 'weekday')!.value)
  return { day, hour: Number(parts.find((p) => p.type === 'hour')!.value) }
}

/** Sends today's due reminders, once per rider per week. Returns how many riders were reminded. */
export async function sendDueReminders(): Promise<number> {
  if (!pushConfigured()) return 0
  const { day, hour } = klNow()
  if (hour < REMINDER_HOUR) return 0
  const week = thisWeek()
  const u = schema.users
  const due = await db
    .select({ id: u.id, lang: u.lang })
    .from(u)
    .where(and(eq(u.paydayWeekday, day), or(isNull(u.lastReminderWeek), ne(u.lastReminderWeek, week))))
  if (!due.length) return 0
  const subs = await db.select().from(schema.pushSubscriptions).where(inArray(schema.pushSubscriptions.userId, due.map((d) => d.id)))
  let sent = 0
  for (const rider of due) {
    const mine = subs.filter((s) => s.userId === rider.id)
    if (!mine.length) continue
    const results = await Promise.all(mine.map((s) => sendPush(s, reminderPayload(rider.lang))))
    await db.update(u).set({ lastReminderWeek: week }).where(eq(u.id, rider.id))
    if (results.some(Boolean)) sent++
  }
  if (sent) log('info', 'payday reminders', { day: todayKL(), riders: sent })
  return sent
}

// Simple for now: a timer inside the API. Use a scheduled job if we run more than one API server.
export function startReminders(everyMs = 15 * 60_000) {
  if (!pushConfigured()) return
  const tick = () => void sendDueReminders().catch((err) => log('error', 'reminders failed', errorFields(err)))
  tick()
  setInterval(tick, everyMs).unref()
}
