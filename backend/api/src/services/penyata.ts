// Slip Gaji and Penyata figures. Every figure carries the weakest source label among the weeks behind it.
// The ML service renders them (HTML for the officer view, PDF via fpdf2) from the same labels.
import { and, eq, gte, lt } from 'drizzle-orm'
import type { User } from '../auth.ts'
import { type Db, schema } from '../db/index.ts'
import { env } from '../env.ts'
import { addDays, addWeeks, thisWeek } from '../lib/weeks.ts'

export const UNLOCK_WEEKS = 12 // uploaded history counts too
const RANK = { self: 0, checked: 1, verified: 2 } as const
type Source = keyof typeof RANK
const weakest = (sources: string[]): Source => (sources as Source[]).reduce<Source>((a, b) => (RANK[b] < RANK[a] ? b : a), 'verified')

export async function weeksLogged(db: Db, userId: number) {
  return (await db.selectDistinct({ w: schema.earnings.weekStart }).from(schema.earnings).where(eq(schema.earnings.userId, userId))).length
}

export async function statement(db: Db, user: User, months: 3 | 6) {
  const end = thisWeek()
  const start = addWeeks(end, -Math.round((months * 52) / 12))
  const rows = await db.select().from(schema.earnings).where(and(eq(schema.earnings.userId, user.id), gte(schema.earnings.weekStart, start), lt(schema.earnings.weekStart, end)))
  const byWeek = new Map<string, { net: number; source: Source; hours: number; sources: string[] }>()
  for (const e of rows) {
    const w = byWeek.get(e.weekStart) ?? { net: 0, source: 'verified', hours: 0, sources: [] }
    w.net += e.grossSen - e.commissionSen + e.incentivesSen + e.tipsSen
    w.hours += e.hoursOnline ?? 0
    w.sources.push(e.verification)
    byWeek.set(e.weekStart, w)
  }
  const weekly = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, w]) => ({ week, ...w, source: weakest(w.sources) }))
  const byMonth = new Map<string, typeof weekly>()
  for (const w of weekly) byMonth.set(w.week.slice(0, 7), [...(byMonth.get(w.week.slice(0, 7)) ?? []), w])
  const nets = weekly.map((w) => w.net)
  const half = Math.floor(nets.length / 2)
  let trend: 'up' | 'down' | 'flat' = 'flat'
  if (half >= 2) {
    const a = nets.slice(0, half).reduce((x, y) => x + y, 0) / half
    const b = nets.slice(half).reduce((x, y) => x + y, 0) / (nets.length - half)
    trend = b > a * 1.05 ? 'up' : b < a * 0.95 ? 'down' : 'flat'
  }
  return {
    from: start,
    to: addDays(end, -1),
    weeks: weekly.length,
    months,
    monthly: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, ws]) => ({
        year: Number(ym.slice(0, 4)),
        month: Number(ym.slice(5, 7)),
        weeks: ws.length,
        netSen: ws.reduce((x, w) => x + w.net, 0),
        avgSen: Math.floor(ws.reduce((x, w) => x + w.net, 0) / ws.length),
        hours: Math.round(ws.reduce((x, w) => x + w.hours, 0)),
        source: weakest(ws.map((w) => w.source)),
      })),
    avgSen: nets.length ? Math.floor(nets.reduce((x, y) => x + y, 0) / nets.length) : 0,
    minSen: nets.length ? Math.min(...nets) : 0,
    maxSen: nets.length ? Math.max(...nets) : 0,
    trend,
    platforms: [...new Set(rows.map((e) => e.platform))].sort(),
    source: weekly.length ? weakest(weekly.map((w) => w.source)) : ('self' as Source),
  }
}

/** A weekly payslip: what came in for the week, and what happened on the payday after it. */
export async function payslip(db: Db, user: User, week: string) {
  const payday = addWeeks(week, 1)
  const earnings = await db.select().from(schema.earnings).where(and(eq(schema.earnings.userId, user.id), eq(schema.earnings.weekStart, week)))
  const costs: Record<string, number> = {}
  for (const x of await db.select().from(schema.expenses).where(and(eq(schema.expenses.userId, user.id), eq(schema.expenses.weekStart, week)))) {
    costs[x.category] = (costs[x.category] ?? 0) + x.amountSen
  }
  const [run] = await db.select().from(schema.salaryRuns).where(and(eq(schema.salaryRuns.userId, user.id), eq(schema.salaryRuns.weekStart, payday)))
  const [t] = await db.select().from(schema.transfers).where(and(eq(schema.transfers.userId, user.id), eq(schema.transfers.weekStart, payday)))
  const gross = earnings.reduce((a, e) => a + e.grossSen, 0)
  return {
    weekStart: week,
    platforms: earnings.map((e) => ({
      platform: e.platform,
      grossSen: e.grossSen,
      commissionSen: e.commissionSen,
      incentivesSen: e.incentivesSen,
      tipsSen: e.tipsSen,
      netSen: e.grossSen - e.commissionSen + e.incentivesSen + e.tipsSen,
      hoursOnline: e.hoursOnline,
      trips: e.trips,
      verification: e.verification,
    })),
    netSen: earnings.reduce((a, e) => a + e.grossSen - e.commissionSen + e.incentivesSen + e.tipsSen, 0),
    costs,
    salarySen: run?.salarySen ?? null,
    perkeso: { deductedAtSource: env.PERKESO_DEDUCTED_AT_SOURCE, estimateSen: Math.round(gross * env.PERKESO_RATE) },
    transfer: t ? { direction: t.direction, amountSen: t.amountSen, status: t.status, allocation: t.allocation } : null,
  }
}
