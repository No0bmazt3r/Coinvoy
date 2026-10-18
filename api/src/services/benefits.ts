// Cuti Berbayar, Caruman, check-ins and streaks (FR-CUTI-*, FR-CAR-*, FR-GAJI-5, FR-STRK-*).
import { and, count, eq, gte, inArray, lt, ne, sql, sum } from 'drizzle-orm'
import type { User } from '../auth.ts'
import { type Db, schema } from '../db/index.ts'
import { env } from '../env.ts'
import { addWeeks, thisWeek, todayKL, weekStart } from '../lib/weeks.ts'
import { ensurePots } from './pots.ts'

// Streak length → level (FR-STRK-4). Cosmetic only: a title and an accent colour, never a feature.
export const LEVELS = [0, 4, 8, 16, 26] as const
export const ACCENTS = ['lime', 'aqua', 'amber', 'pink', 'sky'] as const
const MANUAL_FREEZES_PER_QUARTER = 2

export async function sickStatus(db: Db, user: User) {
  const yearStart = weekStart(`${todayKL().slice(0, 4)}-01-01`)
  const [row] = await db
    .select({ used: sum(schema.leavePlans.days) })
    .from(schema.leavePlans)
    .where(and(eq(schema.leavePlans.userId, user.id), eq(schema.leavePlans.kind, 'sick'), ne(schema.leavePlans.status, 'cancelled'), gte(schema.leavePlans.startWeek, yearStart)))
  return { daysCovered: user.sickDaysCovered, daysUsed: Number(row?.used ?? 0) }
}

/** The rider paid into i-Saraan from their pocket; the government match is capped per year (FR-CAR-2/3). */
export async function contributeIsaraan(db: Db, user: User, amountSen: number) {
  const year = Number(todayKL().slice(0, 4))
  const [row] = await db
    .select({ matched: sum(schema.contributions.matchSen) })
    .from(schema.contributions)
    .where(and(eq(schema.contributions.userId, user.id), eq(schema.contributions.kind, 'isaraan'), eq(schema.contributions.year, year)))
  const matched = Number(row?.matched ?? 0)
  const match = Math.max(0, Math.min(Math.round(amountSen * env.ISARAAN_MATCH_RATE), env.ISARAAN_MATCH_CAP_SEN - matched))
  const pot = (await ensurePots(db, user.id)).isaraan
  await db
    .update(schema.pots)
    .set({ balanceSen: pot.balanceSen - Math.min(pot.balanceSen, amountSen) }) // it left the pocket for EPF
    .where(eq(schema.pots.id, pot.id))
  await db.insert(schema.contributions).values({ userId: user.id, kind: 'isaraan', amountSen, matchSen: match, year })
  return match
}

export async function caruman(db: Db, user: User) {
  const year = Number(todayKL().slice(0, 4))
  const rows = await db.select().from(schema.contributions).where(eq(schema.contributions.userId, user.id))
  const thisYear = rows.filter((r) => r.year === year)
  const paid = thisYear.reduce((a, r) => a + r.amountSen, 0)
  const fullMatchNeeds = Math.round(env.ISARAAN_MATCH_CAP_SEN / env.ISARAAN_MATCH_RATE)
  return {
    isaraan: {
      rate: env.ISARAAN_MATCH_RATE,
      capSen: env.ISARAAN_MATCH_CAP_SEN,
      paidYearSen: paid,
      matchYearSen: thisYear.reduce((a, r) => a + r.matchSen, 0),
      fullMatchNeedsSen: fullMatchNeeds,
      leftForFullMatchSen: Math.max(0, fullMatchNeeds - paid),
      weeklySen: (await ensurePots(db, user.id)).isaraan.weeklySen,
    },
    perkeso: { deductedAtSource: env.PERKESO_DEDUCTED_AT_SOURCE, rate: env.PERKESO_RATE },
    governmentClaimedSen: rows.reduce((a, r) => a + r.matchSen, 0),
  }
}

/** Ask about last week once the rider had a salary for it (FR-GAJI-5). */
export async function checkinDue(db: Db, userId: number): Promise<string | null> {
  const last = addWeeks(thisWeek(), -1)
  const [had] = await db.select({ id: schema.transfers.id }).from(schema.transfers).where(and(eq(schema.transfers.userId, userId), eq(schema.transfers.weekStart, last)))
  const [answered] = await db.select({ id: schema.checkins.id }).from(schema.checkins).where(and(eq(schema.checkins.userId, userId), eq(schema.checkins.weekStart, last)))
  return had && !answered ? last : null
}

async function frozenWeeks(db: Db, userId: number): Promise<Set<string>> {
  const frozen = new Set((await db.select({ w: schema.streakFreezes.weekStart }).from(schema.streakFreezes).where(eq(schema.streakFreezes.userId, userId))).map((r) => r.w))
  const leaves = await db.select().from(schema.leavePlans).where(and(eq(schema.leavePlans.userId, userId), ne(schema.leavePlans.status, 'cancelled')))
  for (const l of leaves) for (let i = 0; i < l.weeks; i++) frozen.add(addWeeks(l.startWeek, i))
  return frozen
}

/**
 * Consecutive logged weeks back from last week. Leave, sick and manual-freeze weeks neither add nor break it
 * (FR-STRK-1/6). Only weeks logged, transfers confirmed and Gaji kept count: never hours or trips.
 */
export async function streak(db: Db, user: User) {
  const logged = new Set((await db.selectDistinct({ w: schema.earnings.weekStart }).from(schema.earnings).where(eq(schema.earnings.userId, user.id))).map((r) => r.w))
  const frozen = await frozenWeeks(db, user.id)
  const now = thisWeek()
  let week = addWeeks(now, -1)
  const atRisk = !logged.has(week) && !frozen.has(week)
  if (atRisk) week = addWeeks(week, -1) // last week can still be logged; count from the week before
  const first = [...logged].sort()[0] ?? now
  let weeks = 0
  while (week >= first) {
    if (logged.has(week)) weeks++
    else if (!frozen.has(week)) break
    week = addWeeks(week, -1)
  }
  if (logged.has(now)) weeks++
  const level = LEVELS.filter((t) => weeks >= t).length - 1
  const month = Number(now.slice(5, 7))
  const quarterStart = weekStart(`${now.slice(0, 4)}-${String(3 * Math.floor((month - 1) / 3) + 1).padStart(2, '0')}-01`)
  const [used] = await db.select({ n: count() }).from(schema.streakFreezes).where(and(eq(schema.streakFreezes.userId, user.id), gte(schema.streakFreezes.weekStart, quarterStart)))
  const [confirmed] = await db
    .select({ n: count() })
    .from(schema.transfers)
    .where(and(eq(schema.transfers.userId, user.id), inArray(schema.transfers.status, ['confirmed', 'partial'])))
  const [kept] = await db.select({ n: count() }).from(schema.checkins).where(and(eq(schema.checkins.userId, user.id), eq(schema.checkins.answer, 'ya')))
  return {
    weeks,
    atRisk: atRisk && weeks > 0,
    frozenThisWeek: frozen.has(now) || frozen.has(addWeeks(now, -1)),
    level,
    nextLevelAt: LEVELS[level + 1] ?? null,
    accents: ACCENTS.slice(0, level + 1) as string[],
    transfersConfirmed: confirmed?.n ?? 0,
    gajiKept: kept?.n ?? 0,
    freezesLeft: Math.max(0, MANUAL_FREEZES_PER_QUARTER - (used?.n ?? 0)),
  }
}

/** Milestones for real progress, awarded from data, never from app opens (FR-STRK-5). */
export async function refreshBadges(db: Db, user: User, streakWeeks: number) {
  const exists = async (q: Promise<unknown[]>) => (await q).length > 0
  const pots = await ensurePots(db, user.id)
  const target = 2 * (user.essentialsWeekSen ?? 0)
  const earned: Record<string, boolean> = {
    minggu_pertama: await exists(db.select({ id: schema.earnings.id }).from(schema.earnings).where(eq(schema.earnings.userId, user.id)).limit(1)),
    pindah_pertama: await exists(
      db
        .select({ id: schema.transfers.id })
        .from(schema.transfers)
        .where(and(eq(schema.transfers.userId, user.id), inArray(schema.transfers.status, ['confirmed', 'partial'])))
        .limit(1),
    ),
    penampan_penuh: target > 0 && pots.penampan.balanceSen >= target,
    cuti_pertama: await exists(
      db
        .select({ id: schema.leavePlans.id })
        .from(schema.leavePlans)
        .where(and(eq(schema.leavePlans.userId, user.id), eq(schema.leavePlans.kind, 'planned'), ne(schema.leavePlans.status, 'cancelled'), lt(schema.leavePlans.startWeek, thisWeek())))
        .limit(1),
    ),
    isaraan_dituntut: await exists(
      db
        .select({ id: schema.contributions.id })
        .from(schema.contributions)
        .where(and(eq(schema.contributions.userId, user.id), sql`${schema.contributions.matchSen} > 0`))
        .limit(1),
    ),
    konsisten_4: streakWeeks >= 4,
    konsisten_12: streakWeeks >= 12,
  }
  const kinds = Object.entries(earned)
    .filter(([, ok]) => ok)
    .map(([kind]) => ({ userId: user.id, kind }))
  if (kinds.length) await db.insert(schema.badges).values(kinds).onConflictDoNothing()
  const rows = await db.select().from(schema.badges).where(eq(schema.badges.userId, user.id)).orderBy(schema.badges.id)
  return rows.map((b) => ({ kind: b.kind, at: b.createdAt.toISOString() }))
}
