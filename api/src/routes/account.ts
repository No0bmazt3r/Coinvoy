// Privacy controls (J8, FR-AUTH-5/6), the statement cross-check (FR-SNAP-10) and Indeks Rider (FR-IDX-*).
import { and, eq, gte } from 'drizzle-orm'
import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { requireUser, SESSION_COOKIE, userOf } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { env } from '../env.ts'
import { ApiError } from '../errors.ts'
import { addWeeks, thisWeek, todayKL } from '../lib/weeks.ts'
import { crossCheck, parseStatement } from '../services/statement.ts'
import { platformsOf } from '../services/salary.ts'

const MIN_GROUP = 20 // Indeks Rider shows nothing for groups smaller than this (FR-IDX-2)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } })

export const accountRouter = Router()
accountRouter.use(requireUser)

// Everything stored about the rider, as one JSON file (FR-AUTH-6).
accountRouter.get('/me/export', async (_req, res) => {
  const user = userOf(res)
  const id = user.id
  const { googleSub: _sub, ...profile } = user
  const s = schema
  const [consents, platforms, earnings, expenses, bills, pots, salaryRuns, transfers, leave, contributions, checkins, streakFreezes, badges, tanyaMessages, links, events, pushSubscriptions] = await Promise.all([
    db.select().from(s.consents).where(eq(s.consents.userId, id)),
    db.select().from(s.userPlatforms).where(eq(s.userPlatforms.userId, id)),
    db.select().from(s.earnings).where(eq(s.earnings.userId, id)),
    db.select().from(s.expenses).where(eq(s.expenses.userId, id)),
    db.select().from(s.bills).where(eq(s.bills.userId, id)),
    db.select().from(s.pots).where(eq(s.pots.userId, id)),
    db.select().from(s.salaryRuns).where(eq(s.salaryRuns.userId, id)),
    db.select().from(s.transfers).where(eq(s.transfers.userId, id)),
    db.select().from(s.leavePlans).where(eq(s.leavePlans.userId, id)),
    db.select().from(s.contributions).where(eq(s.contributions.userId, id)),
    db.select().from(s.checkins).where(eq(s.checkins.userId, id)),
    db.select().from(s.streakFreezes).where(eq(s.streakFreezes.userId, id)),
    db.select().from(s.badges).where(eq(s.badges.userId, id)),
    db.select().from(s.tanyaMessages).where(eq(s.tanyaMessages.userId, id)),
    db.select().from(s.officerLinks).where(eq(s.officerLinks.userId, id)),
    db.select().from(s.events).where(eq(s.events.userId, id)),
    db.select({ endpoint: s.pushSubscriptions.endpoint, createdAt: s.pushSubscriptions.createdAt }).from(s.pushSubscriptions).where(eq(s.pushSubscriptions.userId, id)),
  ])
  const officerLinks = links.map(({ tokenHash: _t, ...l }) => l)
  const data = { exportedAt: new Date().toISOString(), profile, consents, platforms, earnings, expenses, bills, pots, salaryRuns, transfers, leave, contributions, checkins, streakFreezes, badges, tanyaMessages, officerLinks, events, pushSubscriptions }
  res.set({ 'Content-Disposition': `attachment; filename="coinvoy-data-${todayKL()}.json"`, 'Cache-Control': 'no-store' }).json(data)
})

// Delete the account and every row that belongs to it (FR-AUTH-5). Irreversible, so the app asks for "PADAM".
accountRouter.delete('/me', async (req, res) => {
  z.strictObject({ confirm: z.literal('PADAM') }).parse(req.body)
  await db.delete(schema.users).where(eq(schema.users.id, userOf(res).id)) // every table cascades from users
  res.clearCookie(SESSION_COOKIE, { path: '/' }).status(204).end()
})

accountRouter.post('/statement', upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file || !file.buffer.subarray(0, 5).toString().startsWith('%PDF')) throw new ApiError(415, 'not_a_pdf', 'Pilih fail PDF penyata bank atau e-dompet.', 'Choose a bank or e-wallet statement PDF.')
  let lines: string[]
  try {
    const r = await fetch(`${env.ML_URL}/statement/text`, { method: 'POST', headers: { 'X-ML-Token': env.ML_TOKEN, 'Content-Type': 'application/pdf' }, body: new Uint8Array(file.buffer), signal: AbortSignal.timeout(30_000) })
    if (!r.ok) throw new ApiError(422, 'statement_unreadable', 'Penyata ini tak dapat dibaca. Cuba PDF lain (bukan gambar, tanpa kata laluan).', "This statement can't be read. Try another PDF (not a scan, no password).")
    lines = ((await r.json()) as { lines: string[] }).lines
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(503, 'engine_down', 'Enjin sedang berehat. Cuba sebentar lagi.', 'The engine is resting. Try again shortly.')
  }
  const user = userOf(res)
  const result = await crossCheck(db, user.id, parseStatement(lines))
  await db.insert(schema.events).values({ userId: user.id, name: 'statement_checked', props: result })
  res.json(result)
})

// Indeks Rider: anonymised RM per hour by city × platform × month, shown only for groups of 20+ (FR-IDX-2/3).
accountRouter.get('/index', async (_req, res) => {
  const user = userOf(res)
  const since = `${addWeeks(thisWeek(), -13).slice(0, 7)}`
  const city = (user.city ?? '').toLowerCase()
  const groups = []
  for (const platform of await platformsOf(db, user.id)) {
    const rows = await db
      .select({ rate: schema.indexContributions.rateSenPerHour })
      .from(schema.indexContributions)
      .where(and(eq(schema.indexContributions.city, city), eq(schema.indexContributions.platform, platform), gte(schema.indexContributions.month, since)))
    const rates = rows.map((r) => r.rate).sort((a, b) => a - b)
    groups.push({ platform, city: user.city, riders: rates.length >= MIN_GROUP ? rates.length : null, medianSenPerHour: rates.length >= MIN_GROUP ? rates[Math.floor(rates.length / 2)]! : null })
  }
  res.json({ minGroup: MIN_GROUP, groups })
})
