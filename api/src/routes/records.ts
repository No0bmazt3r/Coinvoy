// Rekod: payslips, the Penyata PDF and officer links (FR-SLIP-1..5).
import { randomBytes } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { Router, type Response } from 'express'
import { z } from 'zod'
import { requireUser, sha256, type User, userOf } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { ApiError, notFound } from '../errors.ts'
import { todayKL } from '../lib/weeks.ts'
import { ml } from '../ml.ts'
import { payslip, statement, UNLOCK_WEEKS, weeksLogged } from '../services/penyata.ts'

const LINK_DAYS = 7
type Link = typeof schema.officerLinks.$inferSelect
const linkJson = (l: Link) => ({ id: l.id, months: l.months, expiresAt: l.expiresAt.toISOString(), revoked: l.revokedAt !== null, openedCount: l.openedCount, createdAt: l.createdAt.toISOString() })

async function assertUnlocked(user: User) {
  const n = await weeksLogged(db, user.id)
  if (n < UNLOCK_WEEKS) throw new ApiError(403, 'penyata_locked', `Penyata dibuka selepas 12 minggu data (${n}/12).`, `The statement unlocks with 12 weeks of data (${n}/12).`)
}

export const recordsRouter = Router()

recordsRouter.get('/api/payslip/:week', requireUser, async (req, res) => {
  res.json(await payslip(db, userOf(res), z.iso.date().parse(req.params.week)))
})

recordsRouter.get('/api/penyata', requireUser, async (_req, res) => {
  const user = userOf(res)
  const n = await weeksLogged(db, user.id)
  const unlocked = n >= UNLOCK_WEEKS
  res.json({ weeksLogged: n, unlockAt: UNLOCK_WEEKS, unlocked, summary: unlocked ? await statement(db, user, 3) : null })
})

recordsRouter.get('/api/penyata.pdf', requireUser, async (req, res) => {
  const q = z.object({ months: z.enum(['3', '6']).default('3'), lang: z.enum(['ms', 'en']).default('ms') }).parse(req.query)
  const user = userOf(res)
  await assertUnlocked(user)
  const months = Number(q.months) as 3 | 6
  const pdf = await ml.penyataPdf({ data: await statement(db, user, months), lang: q.lang, name: user.displayName, generated: todayKL() })
  await db.insert(schema.events).values({ userId: user.id, name: 'penyata_generated', props: { months } })
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="coinvoy-penyata-${months}bulan.pdf"`, 'Cache-Control': 'no-store' }).send(pdf)
})

// A read-only Surat Pendapatan link: a random 128-bit token, stored hashed, expiring, revocable.
recordsRouter.post('/api/officer-links', requireUser, async (req, res) => {
  const body = z.strictObject({ months: z.union([z.literal(3), z.literal(6)]).default(3), days: z.number().int().min(1).max(30).default(LINK_DAYS) }).parse(req.body ?? {})
  const user = userOf(res)
  await assertUnlocked(user)
  const token = randomBytes(16).toString('base64url')
  const [link] = await db
    .insert(schema.officerLinks)
    .values({ userId: user.id, tokenHash: sha256(token), months: body.months, expiresAt: new Date(Date.now() + body.days * 86_400_000) })
    .returning()
  res.status(201).json({ link: linkJson(link!), path: `/o/${token}` }) // the raw token is shown once, never stored
})

recordsRouter.get('/api/officer-links', requireUser, async (_req, res) => {
  const rows = await db.select().from(schema.officerLinks).where(eq(schema.officerLinks.userId, userOf(res).id)).orderBy(desc(schema.officerLinks.id))
  res.json({ links: rows.map(linkJson) })
})

recordsRouter.delete('/api/officer-links/:id', requireUser, async (req, res) => {
  const user = userOf(res)
  const [l] = await db.select().from(schema.officerLinks).where(and(eq(schema.officerLinks.id, z.coerce.number().int().parse(req.params.id)), eq(schema.officerLinks.userId, user.id)))
  if (!l) throw notFound()
  if (!l.revokedAt) await db.update(schema.officerLinks).set({ revokedAt: new Date() }).where(eq(schema.officerLinks.id, l.id))
  res.status(204).end()
})

const GONE = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Coinvoy</title>
<body style="font:16px system-ui;padding:32px;max-width:480px;margin:auto">
<h1>Pautan tidak lagi sah</h1><p>Penunggang telah membatalkan pautan ini, atau ia sudah tamat tempoh.</p>
<h1>This link is no longer valid</h1><p>The rider revoked it, or it has expired.</p></body>`

const privateHeaders = (res: Response) => res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })

// Public, read-only, no login. Shows only the Penyata (FR-SLIP-4).
recordsRouter.get('/o/:token', async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'ms'
  const [link] = await db.select().from(schema.officerLinks).where(eq(schema.officerLinks.tokenHash, sha256(String(req.params.token))))
  privateHeaders(res)
  if (!link) throw notFound()
  if (link.revokedAt || link.expiresAt < new Date()) return void res.status(410).type('html').send(GONE)
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, link.userId))
  await db.update(schema.officerLinks).set({ openedCount: link.openedCount + 1 }).where(eq(schema.officerLinks.id, link.id))
  await db.insert(schema.events).values({ userId: user!.id, name: 'officer_link_opened', props: { link_id: link.id } })
  const html = await ml.penyataHtml({ data: await statement(db, user!, link.months as 3 | 6), lang, name: user!.displayName, generated: todayKL(), expires: link.expiresAt.toISOString().slice(0, 10) })
  res.type('html').send(html)
})
