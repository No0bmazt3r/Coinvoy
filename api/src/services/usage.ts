// What the AI costs and whether riders come back: shared by the admin view and scripts/llm-cost-report.ts.
// Prices never live in the app: fill api/data/llm_prices.json from the provider's pricing page and date it.
import { readFileSync } from 'node:fs'
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm'
import { type Db, schema } from '../db/index.ts'

type Prices = { checked: string; usdToMyr: number; hostingMyrPerMonth: number; models: Record<string, { inputPerMillionUsd: number; outputPerMillionUsd: number }> }
export const loadPrices = () => JSON.parse(readFileSync(new URL('../../data/llm_prices.json', import.meta.url), 'utf8')) as Prices

export type UsageRow = { route: string; model: string; calls: number; riders: number; inputTokens: number; outputTokens: number; usd: number | null }

/** LLM usage per route and model since `since`, priced when the model has a price. */
export async function llmUsage(db: Db, since: Date, prices = loadPrices()) {
  const u = schema.llmUsage
  const rows = await db
    .select({
      route: u.route,
      model: u.model,
      calls: sql<number>`count(*)::int`,
      riders: sql<number>`count(DISTINCT ${u.userId})::int`,
      inputTokens: sql<number>`coalesce(sum(${u.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${u.outputTokens}), 0)::int`,
      first: sql<string>`min(${u.createdAt})`,
      last: sql<string>`max(${u.createdAt})`,
    })
    .from(u)
    .where(and(isNotNull(u.userId), gte(u.createdAt, since)))
    .groupBy(u.route, u.model)
  const [all] = await db
    .select({ n: sql<number>`count(DISTINCT ${u.userId})::int` })
    .from(u)
    .where(and(isNotNull(u.userId), gte(u.createdAt, since)))
  const priced: (UsageRow & { first: string; last: string })[] = rows.map((r) => {
    const p = prices.models[r.model]
    return { ...r, usd: p ? (r.inputTokens / 1e6) * p.inputPerMillionUsd + (r.outputTokens / 1e6) * p.outputPerMillionUsd : null }
  })
  return { rows: priced, riders: all?.n ?? 0 }
}

/** Weekly retention: of riders whose first logged week is 4+ weeks old, the share who logged again in week 2, 3 and 4. */
export async function retention(db: Db) {
  const rows = await db
    .select({ userId: schema.earnings.userId, at: schema.earnings.createdAt })
    .from(schema.earnings)
    .innerJoin(schema.users, eq(schema.users.id, schema.earnings.userId))
    .where(eq(schema.users.isDemo, false))
  const byUser = new Map<number, Date[]>()
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.at])
  const WEEK = 7 * 86_400_000
  const cohort = [...byUser.values()].map((ds) => {
    const first = Math.min(...ds.map((d) => d.getTime()))
    return { first, weeks: new Set(ds.map((d) => Math.floor((d.getTime() - first) / WEEK) + 1)) }
  }).filter((c) => Date.now() - c.first >= 4 * WEEK)
  const share = (w: number) => (cohort.length ? cohort.filter((c) => c.weeks.has(w)).length / cohort.length : null)
  return { cohort: cohort.length, week2: share(2), week3: share(3), week4: share(4) }
}

/** Screen guides, real riders only: how many started, finished or skipped each screen's tour. */
export async function guideStats(db: Db) {
  const e = schema.events
  const rows = await db
    .select({ screen: sql<string>`${e.props}->>'screen'`, name: e.name, n: sql<number>`count(DISTINCT ${e.userId})::int` })
    .from(e)
    .innerJoin(schema.users, sql`${schema.users.id} = ${e.userId} AND NOT ${schema.users.isDemo}`)
    .where(sql`${e.name} IN ('tour_started', 'tour_completed', 'tour_skipped')`)
    .groupBy(sql`1`, e.name)
  const out: Record<string, { started: number; completed: number; skipped: number }> = {}
  for (const r of rows) (out[r.screen] ??= { started: 0, completed: 0, skipped: 0 })[r.name.slice(5) as 'started'] = r.n
  return out
}

export async function riderCounts(db: Db) {
  const u = schema.users
  const [r] = await db
    .select({
      riders: sql<number>`count(*) FILTER (WHERE NOT ${u.isDemo})::int`,
      onboarded: sql<number>`count(*) FILTER (WHERE NOT ${u.isDemo} AND ${u.onboardedAt} IS NOT NULL)::int`,
      active7d: sql<number>`count(*) FILTER (WHERE NOT ${u.isDemo} AND ${u.lastLoginAt} > now() - interval '7 days')::int`,
      demos: sql<number>`count(*) FILTER (WHERE ${u.isDemo})::int`,
    })
    .from(u)
  const [push] = await db.select({ n: sql<number>`count(DISTINCT ${schema.pushSubscriptions.userId})::int` }).from(schema.pushSubscriptions)
  return { ...r!, pushReminders: push?.n ?? 0 }
}
