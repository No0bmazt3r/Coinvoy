import { asc, eq } from 'drizzle-orm'
import { isAdmin, type User } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { platformsOf } from './salary.ts'

export type Consents = Partial<Record<'privacy' | 'llm_processing' | 'indeks_rider', { granted: boolean; version: string }>>

/** The signed-in rider as the app sees them (GET /api/auth/me, PATCH /api/me). */
export async function userJson(user: User) {
  const rows = await db.select().from(schema.consents).where(eq(schema.consents.userId, user.id)).orderBy(asc(schema.consents.id))
  const consents: Consents = {}
  for (const c of rows) consents[c.kind as keyof Consents] = { granted: c.granted, version: c.version } // latest wins
  return {
    id: String(user.id),
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isDemo: user.isDemo,
    lang: user.lang,
    theme: user.theme,
    city: user.city,
    paydayWeekday: user.paydayWeekday,
    defaultHours: user.defaultHours,
    essentialsWeekSen: user.essentialsWeekSen,
    pocketReady: user.pocketReady,
    sickDaysCovered: user.sickDaysCovered,
    accent: user.accent,
    platforms: await platformsOf(db, user.id),
    onboarded: user.onboardedAt !== null,
    isAdmin: isAdmin(user.email, user.isDemo),
    consents,
  }
}
