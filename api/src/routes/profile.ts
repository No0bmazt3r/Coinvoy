// Profile, onboarding answers and consent records.
import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { requireUser, userOf } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { ApiError } from '../errors.ts'
import { MAX_SEN, PLATFORMS } from '../lib/limits.ts'
import { streak } from '../services/benefits.ts'
import { userJson } from '../services/profile.ts'
import { recompute } from '../services/salary.ts'


const ProfileIn = z.strictObject({
  lang: z.enum(['ms', 'en']).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  displayName: z.string().min(1).max(60).optional(),
  city: z.string().max(60).nullable().optional(),
  paydayWeekday: z.number().int().min(0).max(6).optional(),
  defaultHours: z.number().int().min(0).max(84).optional(),
  essentialsWeekSen: z.number().int().min(0).max(MAX_SEN).nullable().optional(),
  pocketReady: z.boolean().optional(),
  sickDaysCovered: z.number().int().min(0).max(14).optional(),
  accent: z.enum(['lime', 'aqua', 'amber', 'pink', 'sky']).optional(),
  platforms: z.array(z.enum(PLATFORMS)).max(5).optional(),
  onboarded: z.boolean().optional(),
})
// Changing these changes the salary, so the engine re-runs.
const ENGINE_FIELDS = ['city', 'defaultHours', 'essentialsWeekSen', 'platforms', 'sickDaysCovered'] as const

const ConsentIn = z.strictObject({ kind: z.enum(['privacy', 'llm_processing', 'indeks_rider']), version: z.string().max(20), granted: z.boolean() })

export const profileRouter = Router()
profileRouter.use(requireUser)

profileRouter.patch('/me', async (req, res) => {
  const { platforms, onboarded, ...fields } = ProfileIn.parse(req.body)
  let user = userOf(res)
  if (fields.accent && !(await streak(db, user)).accents.includes(fields.accent)) {
    throw new ApiError(422, 'accent_locked', 'Warna ini belum dibuka.', "This colour isn't unlocked yet.")
  }
  const set = { ...fields, ...(onboarded && !user.onboardedAt ? { onboardedAt: new Date() } : {}) }
  if (Object.keys(set).length) [user] = await db.update(schema.users).set(set).where(eq(schema.users.id, user.id)).returning() as [typeof user]
  if (platforms) {
    await db.delete(schema.userPlatforms).where(eq(schema.userPlatforms.userId, user.id))
    const unique = [...new Set(platforms)]
    if (unique.length) await db.insert(schema.userPlatforms).values(unique.map((platform) => ({ userId: user.id, platform })))
  }
  const body = req.body as Record<string, unknown>
  if (ENGINE_FIELDS.some((f) => f in body)) await recompute(db, user)
  res.json({ user: await userJson(user) })
})

// Screen guides. Once a hint is closed or its tour is finished or skipped, it stays hidden for this account.
// Tour starts, finishes and skips are counted for the admin page.
export const GUIDE_SCREENS = ['gaji', 'tabung', 'snap', 'tanya', 'profil'] as const
const TipIn = z.strictObject({ screen: z.enum(GUIDE_SCREENS), action: z.enum(['seen', 'started', 'completed', 'skipped']) })

profileRouter.post('/tips', async (req, res) => {
  const { screen, action } = TipIn.parse(req.body)
  let user = userOf(res)
  if (action !== 'seen') await db.insert(schema.events).values({ userId: user.id, name: `tour_${action}`, props: { screen } })
  if (action !== 'started' && !user.seenTips.includes(screen)) {
    ;[user] = (await db.update(schema.users).set({ seenTips: [...user.seenTips, screen] }).where(eq(schema.users.id, user.id)).returning()) as [typeof user]
  }
  res.json({ user: await userJson(user) })
})

// "Tunjuk semula panduan": every hint comes back
profileRouter.delete('/tips', async (_req, res) => {
  const [user] = await db.update(schema.users).set({ seenTips: [] }).where(eq(schema.users.id, userOf(res).id)).returning()
  res.json({ user: await userJson(user!) })
})

profileRouter.post('/consents', async (req, res) => {
  const c = ConsentIn.parse(req.body)
  const user = userOf(res)
  await db.insert(schema.consents).values({ userId: user.id, ...c })
  res.status(201).json({ user: await userJson(user) })
})
