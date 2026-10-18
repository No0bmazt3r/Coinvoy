// The judges' demo rider (FR-DEMO-1): Abang Faiz, 12 weeks on Grab + foodpanda in Ipoh, a motorbike instalment,
// a buffer he's been building, and leave planned. SYNTHETIC data, labelled as such: replace with a consented,
// anonymised real history once the interviews are done (decisions.md D2).
import { eq } from 'drizzle-orm'
import type { User } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { addWeeks, thisWeek, todayKL } from '../lib/weeks.ts'
import { ensurePots } from './pots.ts'
import { recompute } from './salary.ts'

const NETS = [62000, 48000, 91000, 55000, 40000, 73000, 95000, 52000, 61000, 44000, 80000, 58000] // RM400–RM950
const PRIVACY_VERSION = '2026-10'

export async function seedDemo(user: User) {
  const now = thisWeek()
  await db.update(schema.users).set({ city: 'Ipoh', defaultHours: 45, essentialsWeekSen: 45_000, paydayWeekday: 0, pocketReady: true, onboardedAt: new Date() }).where(eq(schema.users.id, user.id))
  await db.insert(schema.consents).values([
    { userId: user.id, kind: 'privacy', version: PRIVACY_VERSION, granted: true },
    { userId: user.id, kind: 'llm_processing', version: PRIVACY_VERSION, granted: true },
  ])
  await db.insert(schema.userPlatforms).values([
    { userId: user.id, platform: 'foodpanda' },
    { userId: user.id, platform: 'grab' },
  ])
  await db.insert(schema.earnings).values(
    NETS.flatMap((net, i) => {
      const weekStart = addWeeks(now, i - NETS.length)
      const panda = Math.round(net * 0.6)
      return [
        { userId: user.id, weekStart, platform: 'foodpanda', grossSen: panda + Math.round(panda * 0.15), commissionSen: Math.round(panda * 0.15), trips: Math.round(panda / 700), hoursOnline: 27, source: 'history' },
        { userId: user.id, weekStart, platform: 'grab', grossSen: net - panda, trips: Math.round((net - panda) / 800), hoursOnline: 18, source: 'history' },
      ]
    }),
  )
  await db.insert(schema.bills).values([
    { userId: user.id, name: 'Ansuran motor', amountSen: 28_000, frequency: 'monthly', dueDay: 28 },
    { userId: user.id, name: 'Telefon', amountSen: 3_500, frequency: 'monthly', dueDay: 5 },
    { userId: user.id, name: 'Road tax + insurans', amountSen: 12_000, frequency: 'yearly', dueDate: `${todayKL().slice(0, 4)}-12-15` },
  ])
  const pots = await ensurePots(db, user.id)
  await db.update(schema.pots).set({ balanceSen: 52_000 }).where(eq(schema.pots.id, pots.penampan.id))
  await db.update(schema.pots).set({ balanceSen: 4_000, weeklySen: 1_000 }).where(eq(schema.pots.id, pots.isaraan.id))
  await db.insert(schema.contributions).values({ userId: user.id, kind: 'isaraan', amountSen: 20_000, matchSen: 4_000, year: Number(todayKL().slice(0, 4)) })
  await db.insert(schema.leavePlans).values({ userId: user.id, kind: 'planned', label: 'Cuti akhir tahun', startWeek: addWeeks(now, 9), weeks: 1, setAsideWeekSen: 7_000 })
  await recompute(db, { ...user, city: 'Ipoh', defaultHours: 45, essentialsWeekSen: 45_000 })
}
