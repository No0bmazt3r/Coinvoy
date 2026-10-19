// The judges' demo riders (FR-DEMO-1). SYNTHETIC data, labelled as such: replace with consented, anonymised real
// histories once the interviews are done (decisions.md D2).
// - Abang Faiz: 12 weeks on Grab + foodpanda in Ipoh, a motorbike instalment, a buffer he's been building, leave planned.
// - Kak Lina: a single mother on ShopeeFood in Kuala Lumpur, 30 hours around school runs. Her safe salary is below
//   her essentials, so the demo opens on Jurang (FR-ADV-7).
import { eq } from 'drizzle-orm'
import type { User } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { addWeeks, thisWeek, todayKL } from '../lib/weeks.ts'
import { ensurePots } from './pots.ts'
import { recompute } from './salary.ts'

const PRIVACY_VERSION = '2026-10'

type Persona = {
  name: string
  profile: { city: string; defaultHours: number; essentialsWeekSen: number }
  nets: number[] // weekly net, oldest first
  // How a week's net splits across platforms, with the hours online on each
  platforms: { platform: string; share: number; hours: number; commission: number; senPerTrip: number }[]
  bills: { name: string; amountSen: number; frequency: string; dueDay?: number; dueDate?: string }[]
  penampanSen: number
  isaraan?: { balanceSen: number; weeklySen: number; paidSen: number; matchSen: number }
  leave?: { label: string; inWeeks: number; setAsideWeekSen: number }
}

export const PERSONAS = {
  faiz: {
    name: 'Faiz',
    profile: { city: 'Ipoh', defaultHours: 45, essentialsWeekSen: 38_000 },
    nets: [62000, 48000, 91000, 55000, 40000, 73000, 95000, 52000, 61000, 44000, 80000, 58000], // RM400–RM950
    platforms: [
      { platform: 'foodpanda', share: 0.6, hours: 27, commission: 0.15, senPerTrip: 700 },
      { platform: 'grab', share: 0.4, hours: 18, commission: 0, senPerTrip: 800 },
    ],
    bills: [
      { name: 'Ansuran motor', amountSen: 28_000, frequency: 'monthly', dueDay: 28 },
      { name: 'Telefon', amountSen: 3_500, frequency: 'monthly', dueDay: 5 },
      { name: 'Road tax + insurans', amountSen: 12_000, frequency: 'yearly', dueDate: `${todayKL().slice(0, 4)}-12-15` },
    ],
    penampanSen: 52_000,
    isaraan: { balanceSen: 4_000, weeklySen: 1_000, paidSen: 20_000, matchSen: 4_000 },
    leave: { label: 'Cuti akhir tahun', inWeeks: 9, setAsideWeekSen: 5_000 },
  },
  lina: {
    name: 'Lina',
    profile: { city: 'Kuala Lumpur', defaultHours: 30, essentialsWeekSen: 30_000 },
    nets: [42000, 36000, 49000, 33000, 40000, 46000, 31000, 39000, 44000, 35000, 47000, 38000], // RM310–RM490
    platforms: [{ platform: 'shopeefood', share: 1, hours: 30, commission: 0.2, senPerTrip: 650 }],
    bills: [
      { name: 'Sewa bilik', amountSen: 50_000, frequency: 'monthly', dueDay: 1 },
      { name: 'Yuran pengasuh', amountSen: 20_000, frequency: 'monthly', dueDay: 7 },
      { name: 'Telefon', amountSen: 3_000, frequency: 'monthly', dueDay: 15 },
    ],
    penampanSen: 65_000, // past the build-up target (2 weeks of essentials), so the gap is about income, not saving
  },
} satisfies Record<string, Persona>

export type PersonaKey = keyof typeof PERSONAS

export async function seedDemo(user: User, key: PersonaKey = 'faiz') {
  const p: Persona = PERSONAS[key]
  const now = thisWeek()
  await db.update(schema.users).set({ ...p.profile, paydayWeekday: 0, pocketReady: true, onboardedAt: new Date() }).where(eq(schema.users.id, user.id))
  await db.insert(schema.consents).values([
    { userId: user.id, kind: 'privacy', version: PRIVACY_VERSION, granted: true },
    { userId: user.id, kind: 'llm_processing', version: PRIVACY_VERSION, granted: true },
  ])
  await db.insert(schema.userPlatforms).values(p.platforms.map((x) => ({ userId: user.id, platform: x.platform })))
  await db.insert(schema.earnings).values(
    p.nets.flatMap((net, i) =>
      p.platforms.map((x) => {
        const part = Math.round(net * x.share)
        const commissionSen = Math.round(part * x.commission)
        return { userId: user.id, weekStart: addWeeks(now, i - p.nets.length), platform: x.platform, grossSen: part + commissionSen, commissionSen, trips: Math.round(part / x.senPerTrip), hoursOnline: x.hours, source: 'history' }
      }),
    ),
  )
  await db.insert(schema.bills).values(p.bills.map((b) => ({ userId: user.id, ...b })))
  const pots = await ensurePots(db, user.id)
  await db.update(schema.pots).set({ balanceSen: p.penampanSen }).where(eq(schema.pots.id, pots.penampan.id))
  if (p.isaraan) {
    await db.update(schema.pots).set({ balanceSen: p.isaraan.balanceSen, weeklySen: p.isaraan.weeklySen }).where(eq(schema.pots.id, pots.isaraan.id))
    await db.insert(schema.contributions).values({ userId: user.id, kind: 'isaraan', amountSen: p.isaraan.paidSen, matchSen: p.isaraan.matchSen, year: Number(todayKL().slice(0, 4)) })
  }
  if (p.leave) await db.insert(schema.leavePlans).values({ userId: user.id, kind: 'planned', label: p.leave.label, startWeek: addWeeks(now, p.leave.inWeeks), weeks: 1, setAsideWeekSen: p.leave.setAsideWeekSen })
  await recompute(db, { ...user, ...p.profile })
}
