// Earnings weeks and the bills calendar.
import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { requireUser, userOf } from '../auth.ts'
import { type Db, db, schema } from '../db/index.ts'
import { ApiError, notFound } from '../errors.ts'
import { addWeeks, isMonday, thisWeek } from '../lib/weeks.ts'
import { contributeToIndex } from '../services/indeks.ts'
import { recompute } from '../services/salary.ts'
import { MAX_SEN, PLATFORMS } from '../lib/limits.ts'

const sen = z.number().int().min(0).max(MAX_SEN)
export const EarningIn = z.strictObject({
  platform: z.enum(PLATFORMS),
  grossSen: sen,
  commissionSen: sen.default(0),
  incentivesSen: sen.default(0),
  tipsSen: sen.default(0),
  trips: z.number().int().min(0).max(2000).nullable().default(null),
  hoursOnline: z.number().min(0).max(168).nullable().default(null),
  source: z.enum(['snap', 'manual', 'history']).default('manual'),
  extractionConfidence: z.enum(['high', 'medium', 'low']).nullable().default(null),
})
const WeeksIn = z.strictObject({
  weeks: z.array(z.strictObject({ weekStart: z.iso.date(), platforms: z.array(EarningIn).min(1).max(5) })).min(1).max(26), // history upload confirms many
})
const BillIn = z
  .strictObject({
    name: z.string().min(1).max(60),
    amountSen: z.number().int().positive().max(MAX_SEN),
    frequency: z.enum(['weekly', 'monthly', 'yearly', 'once']),
    dueDay: z.number().int().min(0).max(31).nullable().default(null),
    dueDate: z.iso.date().nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine((b) => b.frequency !== 'weekly' || b.dueDay === null || b.dueDay <= 6, { message: 'weekly dueDay is a weekday, 0-6', path: ['dueDay'] })
  .refine((b) => b.frequency !== 'monthly' || (b.dueDay ?? 0) >= 1, { message: 'monthly bills need dueDay 1-31', path: ['dueDay'] })
  .refine((b) => !['yearly', 'once'].includes(b.frequency) || b.dueDate !== null, { message: 'yearly and one-off bills need dueDate', path: ['dueDate'] })

type Earning = typeof schema.earnings.$inferSelect
const net = (e: Earning) => e.grossSen - e.commissionSen + e.incentivesSen + e.tipsSen
export const earningJson = (e: Earning) => ({
  id: e.id, weekStart: e.weekStart, platform: e.platform, grossSen: e.grossSen, commissionSen: e.commissionSen, incentivesSen: e.incentivesSen,
  tipsSen: e.tipsSen, netSen: net(e), trips: e.trips, hoursOnline: e.hoursOnline, source: e.source, verification: e.verification,
})
const billJson = (b: typeof schema.bills.$inferSelect) => ({ id: b.id, name: b.name, amountSen: b.amountSen, frequency: b.frequency, dueDay: b.dueDay, dueDate: b.dueDate, active: b.active })
const id = (v: unknown) => z.coerce.number().int().positive().parse(v)

export const weeksRouter = Router()
weeksRouter.use(requireUser)

async function upsertEarning(tx: Db, userId: number, weekStart: string, row: z.infer<typeof EarningIn>) {
  // A re-entered figure is self-reported again until cross-checked.
  const values = { ...row, verification: 'self' }
  await tx
    .insert(schema.earnings)
    .values({ userId, weekStart, ...values })
    .onConflictDoUpdate({ target: [schema.earnings.userId, schema.earnings.weekStart, schema.earnings.platform], set: values })
}

// Nothing from Snap is saved until the rider confirms it here.
weeksRouter.post('/weeks/confirm', async (req, res) => {
  const { weeks } = WeeksIn.parse(req.body)
  const user = userOf(res)
  const now = thisWeek()
  for (const wk of weeks) {
    if (!isMonday(wk.weekStart) || wk.weekStart > now || wk.weekStart < addWeeks(now, -104)) throw new ApiError(422, 'bad_week', 'Minggu tidak sah.', "That week isn't valid.")
  }
  await db.transaction(async (tx) => {
    for (const wk of weeks) {
      for (const row of wk.platforms) await upsertEarning(tx, user.id, wk.weekStart, row)
      await tx.insert(schema.events).values({ userId: user.id, name: 'week_logged', props: { week: wk.weekStart, source: wk.platforms[0]!.source } })
    }
  })
  await contributeToIndex(db, user, weeks)
  await recompute(db, user)
  res.json({ ok: true })
})

weeksRouter.get('/weeks', async (_req, res) => {
  const rows = await db.select().from(schema.earnings).where(eq(schema.earnings.userId, userOf(res).id)).orderBy(desc(schema.earnings.weekStart), schema.earnings.platform)
  const weeks = new Map<string, Earning[]>()
  for (const e of rows) weeks.set(e.weekStart, [...(weeks.get(e.weekStart) ?? []), e])
  res.json({
    weeks: [...weeks].map(([weekStart, es]) => ({
      weekStart,
      netSen: es.reduce((a, e) => a + net(e), 0),
      hours: es.reduce((a, e) => a + (e.hoursOnline ?? 0), 0) || null,
      verification: es.every((e) => e.verification !== 'self') ? 'checked' : 'self',
      platforms: es.map(earningJson),
    })),
  })
})

const ownEarning = async (userId: number, earningId: number) => {
  const [e] = await db.select().from(schema.earnings).where(and(eq(schema.earnings.id, earningId), eq(schema.earnings.userId, userId)))
  if (!e) throw notFound()
  return e
}

weeksRouter.patch('/earnings/:id', async (req, res) => {
  const user = userOf(res)
  const e = await ownEarning(user.id, id(req.params.id))
  const body = EarningIn.parse(req.body)
  const [updated] = await db.update(schema.earnings).set({ ...body, verification: 'self' }).where(eq(schema.earnings.id, e.id)).returning()
  await recompute(db, user)
  res.json({ earning: earningJson(updated!) })
})

weeksRouter.delete('/earnings/:id', async (req, res) => {
  const user = userOf(res)
  const e = await ownEarning(user.id, id(req.params.id))
  await db.delete(schema.earnings).where(eq(schema.earnings.id, e.id))
  await recompute(db, user)
  res.status(204).end()
})

weeksRouter.get('/bills', async (_req, res) => {
  const rows = await db.select().from(schema.bills).where(eq(schema.bills.userId, userOf(res).id)).orderBy(schema.bills.id)
  res.json({ bills: rows.map(billJson) })
})

weeksRouter.post('/bills', async (req, res) => {
  const user = userOf(res)
  const [bill] = await db.insert(schema.bills).values({ userId: user.id, ...BillIn.parse(req.body) }).returning()
  await recompute(db, user)
  res.status(201).json({ bill: billJson(bill!) })
})

const ownBill = async (userId: number, billId: number) => {
  const [b] = await db.select().from(schema.bills).where(and(eq(schema.bills.id, billId), eq(schema.bills.userId, userId)))
  if (!b) throw notFound()
  return b
}

weeksRouter.patch('/bills/:id', async (req, res) => {
  const user = userOf(res)
  const b = await ownBill(user.id, id(req.params.id))
  const [bill] = await db.update(schema.bills).set(BillIn.parse(req.body)).where(eq(schema.bills.id, b.id)).returning()
  await recompute(db, user)
  res.json({ bill: billJson(bill!) })
})

weeksRouter.delete('/bills/:id', async (req, res) => {
  const user = userOf(res)
  const b = await ownBill(user.id, id(req.params.id))
  await db.delete(schema.bills).where(eq(schema.bills.id, b.id))
  await recompute(db, user)
  res.status(204).end()
})
