// RM per active rider per month from measured llm_usage rows and a dated price table (decisions.md A5).
// Prices never live in the app: fill api/data/llm_prices.json from your provider's pricing page and date it.
//
//   node --env-file=../.env scripts/llm-cost-report.ts
import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.ts'

type Prices = { checked: string; usdToMyr: number; hostingMyrPerMonth: number; models: Record<string, { inputPerMillionUsd: number; outputPerMillionUsd: number }> }
const prices = JSON.parse(readFileSync(new URL('../data/llm_prices.json', import.meta.url), 'utf8')) as Prices

const result = (await db.execute(sql`
  SELECT model, route, count(DISTINCT user_id) AS riders, sum(input_tokens) AS input, sum(output_tokens) AS output,
         min(created_at) AS since, max(created_at) AS until
    FROM llm_usage WHERE user_id IS NOT NULL GROUP BY model, route`)) as unknown as { rows: { model: string; route: string; riders: number; input: number; output: number; since: string; until: string }[] }

let usdTotal = 0
const ridersRow = (await db.execute(sql`SELECT count(DISTINCT user_id) AS n FROM llm_usage WHERE user_id IS NOT NULL`)) as unknown as { rows: { n: number }[] }
const activeRiders = Number(ridersRow.rows[0]?.n ?? 0)
if (!result.rows.length || !activeRiders) {
  console.log('No llm_usage rows yet: run the pilot (or your own testing) with a real LLM key first.')
  process.exit(0)
}
const first = new Date(Math.min(...result.rows.map((r) => Date.parse(r.since))))
const last = new Date(Math.max(...result.rows.map((r) => Date.parse(r.until))))
const months = Math.max(1 / 30, (last.getTime() - first.getTime()) / (30 * 86_400_000))
console.log(`Prices checked ${prices.checked}; usage ${first.toISOString().slice(0, 10)} → ${last.toISOString().slice(0, 10)}, ${activeRiders} riders\n`)
for (const r of result.rows) {
  const p = prices.models[r.model]
  if (!p) {
    console.log(`  ${r.route.padEnd(7)} ${r.model}: no price in llm_prices.json, skipped`)
    continue
  }
  const usd = (Number(r.input) / 1e6) * p.inputPerMillionUsd + (Number(r.output) / 1e6) * p.outputPerMillionUsd
  usdTotal += usd
  console.log(`  ${r.route.padEnd(7)} ${r.model}: RM${((usd * prices.usdToMyr) / activeRiders / months).toFixed(3)} per rider per month`)
}
const llmPerRider = (usdTotal * prices.usdToMyr) / activeRiders / months
console.log(`\nLLM per active rider per month: RM${llmPerRider.toFixed(2)}`)
for (const n of [100, 10_000, 100_000]) {
  const perRider = llmPerRider + prices.hostingMyrPerMonth / n
  console.log(`  at ${String(n).padStart(7)} riders: RM${perRider.toFixed(2)} per rider (RM${Math.round(perRider * n).toLocaleString('en-MY')} a month)`)
}
process.exit(0)
