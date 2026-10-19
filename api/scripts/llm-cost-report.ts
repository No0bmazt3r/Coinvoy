// RM per active rider per month from measured llm_usage rows and a dated price table (decisions.md A5).
// Prices never live in the app: fill api/data/llm_prices.json from your provider's pricing page and date it.
// The admin view (/admin) shows the same numbers for the last 30 days.
//
//   node --env-file=../.env scripts/llm-cost-report.ts
import { db, migrate } from '../src/db/index.ts'
import { llmUsage, loadPrices } from '../src/services/usage.ts'

await migrate() // a fresh database has no tables yet
const prices = loadPrices()
const { rows, riders } = await llmUsage(db, new Date(0), prices)
if (!rows.length || !riders) {
  console.log('No llm_usage rows yet: run the pilot (or your own testing) with a real LLM key first.')
  process.exit(0)
}
const first = new Date(Math.min(...rows.map((r) => Date.parse(r.first))))
const last = new Date(Math.max(...rows.map((r) => Date.parse(r.last))))
const months = Math.max(1 / 30, (last.getTime() - first.getTime()) / (30 * 86_400_000))
console.log(`Prices checked ${prices.checked || 'NEVER (fill llm_prices.json)'}; usage ${first.toISOString().slice(0, 10)} → ${last.toISOString().slice(0, 10)}, ${riders} riders\n`)
let usdTotal = 0
for (const r of rows) {
  if (r.usd === null) {
    console.log(`  ${r.route.padEnd(7)} ${r.model}: no price in llm_prices.json, skipped`)
    continue
  }
  usdTotal += r.usd
  console.log(`  ${r.route.padEnd(7)} ${r.model}: RM${((r.usd * prices.usdToMyr) / riders / months).toFixed(3)} per rider per month`)
}
const llmPerRider = (usdTotal * prices.usdToMyr) / riders / months
console.log(`\nLLM per active rider per month: RM${llmPerRider.toFixed(2)}`)
for (const n of [100, 10_000, 100_000]) {
  const perRider = llmPerRider + prices.hostingMyrPerMonth / n
  console.log(`  at ${String(n).padStart(7)} riders: RM${perRider.toFixed(2)} per rider (RM${Math.round(perRider * n).toLocaleString('en-MY')} a month)`)
}
process.exit(0)
