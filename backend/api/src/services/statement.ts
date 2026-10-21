// Cross-checking against a bank or e-wallet statement. A logged week becomes
// "Disemak silang" when a platform payout on the statement matches it, and a transfer when a move into a savings
// pocket matches what the rider confirmed. The PDF is never stored: only the labels change.
import { and, eq, inArray } from 'drizzle-orm'
import { type Db, schema } from '../db/index.ts'
import { addWeeks, weekStart } from '../lib/weeks.ts'

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, mac: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12 }
const PLATFORM: [RegExp, string][] = [
  [/\bgrab\b/i, 'grab'],
  [/food\s?panda|delivery\s?hero/i, 'foodpanda'],
  [/shopee/i, 'shopeefood'],
  [/lalamove/i, 'lalamove'],
]
const POCKET = /\b(pocket|savings?|simpanan|tabung|goal|jar|saving space)\b/i
const TOLERANCE = 0.05 // a payout within 5% of the logged figure (rounding, small fees) counts as a match

export type Entry = { date: string; sen: number; platform: string | null; pocket: boolean }

function parseDate(line: string): string | null {
  let m = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = line.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/) // dd/mm/yyyy, as Malaysian banks print it
  if (m) return `${m[3]!.length === 2 ? `20${m[3]}` : m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
  m = line.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\b/)
  const month = m && MONTHS[m[2]!.toLowerCase()]
  if (m && month) return `${m[3]}-${String(month).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
  return null
}

/** Statement text lines → dated amounts that look like platform payouts or pocket transfers. */
export function parseStatement(lines: string[]): Entry[] {
  const out: Entry[] = []
  for (const line of lines) {
    const date = parseDate(line)
    const platform = PLATFORM.find(([re]) => re.test(line))?.[1] ?? null
    const pocket = POCKET.test(line)
    if (!date || (!platform && !pocket)) continue
    const amounts = [...line.matchAll(/(?:RM\s?)?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\b/gi)]
    const last = amounts.at(0) // the transaction amount comes before the running balance
    if (!last) continue
    out.push({ date, sen: Number(last[1]!.replace(/,/g, '')) * 100 + Number(last[2]), platform, pocket })
  }
  return out
}

const near = (a: number, b: number) => b > 0 && Math.abs(a - b) <= Math.max(100, b * TOLERANCE)

export async function crossCheck(db: Db, userId: number, entries: Entry[]) {
  const earnings = await db.select().from(schema.earnings).where(eq(schema.earnings.userId, userId))
  const payouts = new Map<string, number>() // `${week}:${platform}` → total paid out for that earnings week
  for (const e of entries.filter((x) => x.platform)) {
    // A payout lands in the week after the work, or the same week for daily cash-outs: try both.
    for (const week of [addWeeks(weekStart(e.date), -1), weekStart(e.date)]) {
      const key = `${week}:${e.platform}`
      payouts.set(key, (payouts.get(key) ?? 0) + e.sen)
    }
  }
  const checkedEarnings = earnings.filter((e) => {
    const paid = payouts.get(`${e.weekStart}:${e.platform}`) ?? 0
    return near(paid, e.grossSen - e.commissionSen + e.incentivesSen) || near(paid, e.grossSen)
  })
  if (checkedEarnings.length) await db.update(schema.earnings).set({ verification: 'checked' }).where(inArray(schema.earnings.id, checkedEarnings.map((e) => e.id)))

  const transfers = await db
    .select()
    .from(schema.transfers)
    .where(and(eq(schema.transfers.userId, userId), inArray(schema.transfers.status, ['confirmed', 'partial'])))
  const pockets = entries.filter((x) => x.pocket)
  const checkedTransfers = transfers.filter((t) =>
    pockets.some((p) => near(p.sen, t.confirmedAmountSen ?? 0) && [t.weekStart, addWeeks(t.weekStart, 1)].includes(weekStart(p.date))),
  )
  if (checkedTransfers.length) await db.update(schema.transfers).set({ verification: 'checked' }).where(inArray(schema.transfers.id, checkedTransfers.map((t) => t.id)))
  return { entriesFound: entries.length, weeksChecked: new Set(checkedEarnings.map((e) => e.weekStart)).size, transfersChecked: checkedTransfers.length }
}
