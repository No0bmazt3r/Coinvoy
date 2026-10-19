// The team's usage view (/admin): rider counts, retention and AI cost. Only for ADMIN_EMAILS; never shows a rider's data.
import { Router } from 'express'
import { requireUser, userOf } from '../auth.ts'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { notFound } from '../errors.ts'
import { llmUsage, loadPrices, retention, riderCounts } from '../services/usage.ts'

export const isAdmin = (email: string, isDemo: boolean) => !isDemo && env.ADMIN_EMAILS.includes(email.toLowerCase())

export const adminRouter = Router()

adminRouter.get('/admin/usage', requireUser, async (_req, res) => {
  const user = userOf(res)
  if (!isAdmin(user.email, user.isDemo)) throw notFound() // don't reveal that the page exists
  const prices = loadPrices()
  const since = new Date(Date.now() - 30 * 86_400_000)
  const [llm, riders, kept] = await Promise.all([llmUsage(db, since, prices), riderCounts(db), retention(db)])
  const usd = llm.rows.reduce((a, r) => a + (r.usd ?? 0), 0)
  res.json({
    riders,
    retention: kept,
    llm: {
      days: 30,
      rows: llm.rows.map(({ first: _f, last: _l, usd, ...r }) => ({ ...r, myr: usd === null ? null : usd * prices.usdToMyr })),
      riders: llm.riders,
      myrPerRider: llm.riders && prices.checked ? (usd * prices.usdToMyr) / llm.riders : null,
      pricesChecked: prices.checked || null,
    },
  })
})
