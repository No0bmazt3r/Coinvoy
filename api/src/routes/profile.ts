// Profile, onboarding answers and consent records (FR-ONB-1..4, FR-ONB-6).
import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { requireUser, userOf } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { ApiError } from '../errors.ts'
import { streak } from '../services/benefits.ts'
import { userJson } from '../services/profile.ts'
import { recompute } from '../services/salary.ts'

export const PLATFORMS = ['grab', 'foodpanda', 'shopeefood', 'lalamove', 'other'] as const
export const MAX_SEN = 10_000_000 // RM100,000 (architecture §8.2)

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

profileRouter.post('/consents', async (req, res) => {
  const c = ConsentIn.parse(req.body)
  const user = userOf(res)
  await db.insert(schema.consents).values({ userId: user.id, ...c })
  res.status(201).json({ user: await userJson(user) })
})
