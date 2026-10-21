// The home screen in one call (FR-GAJI-1), the weekly transfer (FR-GAJI-2/3) and pots.
import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { requireUser, userOf } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { notFound } from '../errors.ts'
import { addWeeks, thisWeek } from '../lib/weeks.ts'
import { checkinDue, streak } from '../services/benefits.ts'
import { addPot, closePot, confirmTransfer, CUSTOM_ICONS, ensurePots, POT_KINDS, type Pot } from '../services/pots.ts'
import { classify, preview, suggestions } from '../services/reco.ts'
import { currentWeek, recompute, weeklyHistory } from '../services/salary.ts'
import { MAX_SEN } from '../lib/limits.ts'

type Transfer = typeof schema.transfers.$inferSelect
export const transferJson = (t: Transfer | undefined) =>
  t
    ? {
        id: t.id, weekStart: t.weekStart, direction: t.direction, amountSen: t.amountSen, allocation: t.allocation, status: t.status,
        confirmedAmountSen: t.confirmedAmountSen, confirmedAt: t.confirmedAt?.toISOString() ?? null, verification: t.verification,
      }
    : null
export const potJson = (p: Pot) => ({ kind: p.kind, name: p.name, icon: p.icon, active: p.active, balanceSen: p.balanceSen, targetSen: p.targetSen, weeklySen: p.weeklySen })

export const homeRouter = Router()
homeRouter.use(requireUser)

homeRouter.get('/home', async (_req, res) => {
  const user = userOf(res)
  const history = await weeklyHistory(db, user.id)
  const runWeek = await currentWeek(db, user.id)
  let [run] = await db.select().from(schema.salaryRuns).where(and(eq(schema.salaryRuns.userId, user.id), eq(schema.salaryRuns.weekStart, runWeek)))
  if (!run) [run] = await db.select().from(schema.salaryRuns).where(eq(schema.salaryRuns.userId, user.id)).orderBy(desc(schema.salaryRuns.weekStart)).limit(1)
  const [transfer] = run ? await db.select().from(schema.transfers).where(and(eq(schema.transfers.userId, user.id), eq(schema.transfers.weekStart, run.weekStart))) : []
  const pots = await ensurePots(db, user.id)
  const last = history.at(-1)?.weekStart ?? null
  const r = run?.result
  res.json({
    salary:
      run && r
        ? {
            weekStart: run.weekStart, salarySen: run.salarySen, pSafe: run.pSafe, risk: run.risk, factors: r.factors, band: r.band, buildUp: r.buildUp, jurang: r.jurang,
            coldStart: r.coldStart, weeksUsed: r.weeksUsed, plannedHours: r.plannedHours, fromCutiSen: r.fromCutiSen, billsThisWeekSen: r.billsThisWeekSen,
            salaryDeltaSen: r.salaryDeltaSen ?? null,
          }
        : null,
    transfer: transferJson(transfer),
    buffer: potJson(pots.penampan),
    lastLoggedWeek: last,
    // Due to Snap when last week (or this one, if already worked) isn't in yet.
    needsSnap: last === null || last < addWeeks(thisWeek(), -1),
    weeksLogged: history.length,
    checkinDue: await checkinDue(db, user.id),
    streak: await streak(db, user),
  })
})

homeRouter.post('/transfers/:id/confirm', async (req, res) => {
  const user = userOf(res)
  const { amountSen } = z.strictObject({ amountSen: z.number().int().min(0).max(MAX_SEN).nullable().optional() }).parse(req.body ?? {})
  const [t] = await db.select().from(schema.transfers).where(and(eq(schema.transfers.id, z.coerce.number().int().parse(req.params.id)), eq(schema.transfers.userId, user.id)))
  if (!t) throw notFound()
  res.json({ transfer: transferJson(await confirmTransfer(db, t, amountSen ?? null)) })
})

homeRouter.get('/pots', async (_req, res) => {
  const pots = await ensurePots(db, userOf(res).id)
  const order = (k: string) => { const i = (POT_KINDS as readonly string[]).indexOf(k); return i < 0 ? POT_KINDS.length : i }
  res.json({ pots: Object.values(pots).sort((a, b) => order(a.kind) - order(b.kind) || a.id - b.id).map(potJson) })
})

const Money = z.number().int().min(0).max(MAX_SEN)

// The "+" sheet: rule-based suggestions (AI-ordered and worded when allowed), a custom pot's category, and the salary preview.
homeRouter.get('/pots/suggestions', async (_req, res) => {
  res.json(await suggestions(db, userOf(res)))
})

homeRouter.post('/pots/classify', async (req, res) => {
  const { name } = z.strictObject({ name: z.string().trim().min(1).max(40) }).parse(req.body)
  res.json(await classify(db, userOf(res), name))
})

homeRouter.post('/pots/preview', async (req, res) => {
  const { weeklySen } = z.strictObject({ weeklySen: Money }).parse(req.body)
  res.json({ preview: await preview(db, userOf(res), weeklySen) })
})

homeRouter.post('/pots', async (req, res) => {
  const user = userOf(res)
  const body = z
    .strictObject({ kind: z.string().max(20).optional(), name: z.string().trim().min(1).max(40).optional(), icon: z.enum(CUSTOM_ICONS).optional(), targetSen: Money, weeklySen: Money })
    .refine((b) => Boolean(b.kind) !== Boolean(b.name), 'either kind or name')
    .parse(req.body)
  const pot = await addPot(db, user.id, body)
  await recompute(db, user)
  res.status(201).json({ pot: potJson(pot) })
})

homeRouter.patch('/pots/:kind', async (req, res) => {
  const user = userOf(res)
  const pot = (await ensurePots(db, user.id))[req.params.kind]
  if (!pot) throw notFound()
  const body = z
    .strictObject({ targetSen: Money.optional(), weeklySen: Money.optional(), name: z.string().trim().min(1).max(40).optional(), icon: z.enum(CUSTOM_ICONS).optional() })
    .parse(req.body)
  if ((body.name || body.icon) && !pot.kind.startsWith('c-')) throw notFound()
  const [updated] = await db.update(schema.pots).set(body).where(eq(schema.pots.id, pot.id)).returning()
  if (body.weeklySen !== undefined) await recompute(db, user)
  res.json({ pot: potJson(updated!) })
})

homeRouter.post('/pots/:kind/close', async (req, res) => {
  const user = userOf(res)
  const result = await closePot(db, user.id, req.params.kind)
  await recompute(db, user)
  res.json(result)
})
