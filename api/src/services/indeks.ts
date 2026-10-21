// Indeks Rider (FR-IDX-*): anonymised RM per hour by city × platform × month.
import { and, desc, eq, gte } from 'drizzle-orm'
import type { User } from '../auth.ts'
import { type Db, schema } from '../db/index.ts'
import { addWeeks, thisWeek } from '../lib/weeks.ts'
import { platformsOf } from './salary.ts'

export const MIN_GROUP = 20 // shows nothing for groups smaller than this (FR-IDX-2)

type Week = { weekStart: string; platforms: { platform: string; grossSen: number; commissionSen: number; incentivesSen: number; hoursOnline: number | null }[] }

/** Only with the separate consent, and the rows carry no user id (FR-IDX-1). */
export async function contributeToIndex(db: Db, user: User, weeks: Week[]) {
  const [consent] = await db.select().from(schema.consents).where(and(eq(schema.consents.userId, user.id), eq(schema.consents.kind, 'indeks_rider'))).orderBy(desc(schema.consents.id)).limit(1)
  if (!consent?.granted || !user.city) return
  const rows = weeks.flatMap((w) =>
    w.platforms
      .filter((p) => p.hoursOnline && p.hoursOnline > 0)
      .map((p) => ({ city: user.city!.toLowerCase(), platform: p.platform, month: w.weekStart.slice(0, 7), rateSenPerHour: Math.round((p.grossSen - p.commissionSen + p.incentivesSen) / p.hoursOnline!) })),
  )
  if (rows.length) await db.insert(schema.indexContributions).values(rows)
}

/** The rider's own city and platforms over the last quarter, groups of 20+ only (FR-IDX-2/3). */
export async function riderIndex(db: Db, user: User) {
  const since = addWeeks(thisWeek(), -13).slice(0, 7)
  const city = (user.city ?? '').toLowerCase()
  const groups = []
  for (const platform of await platformsOf(db, user.id)) {
    const rows = await db
      .select({ rate: schema.indexContributions.rateSenPerHour })
      .from(schema.indexContributions)
      .where(and(eq(schema.indexContributions.city, city), eq(schema.indexContributions.platform, platform), gte(schema.indexContributions.month, since)))
    const rates = rows.map((r) => r.rate).sort((a, b) => a - b)
    const enough = rates.length >= MIN_GROUP
    groups.push({ platform, city: user.city, riders: enough ? rates.length : null, medianSenPerHour: enough ? rates[Math.floor(rates.length / 2)]! : null })
  }
  return { minGroup: MIN_GROUP, groups }
}
