// Device subscriptions for the payday reminder (FR-GAJI-6). The browser asks the rider first; nothing is sent without it.
import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { requireUser, userOf } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { env, pushConfigured } from '../env.ts'
import { ApiError } from '../errors.ts'
import { reminderPayload, sendPush } from '../services/reminders.ts'

const Subscription = z.strictObject({
  endpoint: z.url().max(1000).refine((u) => u.startsWith('https://'), 'https only'),
  expirationTime: z.number().nullish(),
  keys: z.strictObject({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

export const pushRouter = Router()

pushRouter.get('/push', requireUser, async (_req, res) => {
  const subs = await db.select({ endpoint: schema.pushSubscriptions.endpoint }).from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userOf(res).id))
  res.json({ publicKey: pushConfigured() ? env.VAPID_PUBLIC_KEY : null, endpoints: subs.map((s) => s.endpoint) })
})

pushRouter.post('/push', requireUser, async (req, res) => {
  if (!pushConfigured()) throw new ApiError(503, 'push_off', 'Peringatan belum disediakan.', "Reminders aren't set up yet.")
  const sub = Subscription.parse(req.body)
  const row = { userId: userOf(res).id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }
  // An endpoint belongs to one browser; if another rider signed in on it before, it moves to this one.
  await db.insert(schema.pushSubscriptions).values(row).onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: row })
  res.status(204).end()
})

pushRouter.delete('/push', requireUser, async (req, res) => {
  const { endpoint } = z.strictObject({ endpoint: z.string().max(1000) }).parse(req.body)
  await db.delete(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.userId, userOf(res).id), eq(schema.pushSubscriptions.endpoint, endpoint)))
  res.status(204).end()
})

// "Cuba sekarang": the same reminder, now, so the rider (or a judge) sees what payday looks like.
pushRouter.post('/push/test', requireUser, async (_req, res) => {
  const user = userOf(res)
  const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, user.id))
  if (!subs.length) throw new ApiError(409, 'no_subscription', 'Hidupkan peringatan dahulu.', 'Turn reminders on first.')
  const sent = (await Promise.all(subs.map((s) => sendPush(s, reminderPayload(user.lang))))).filter(Boolean).length
  res.json({ sent })
})
