// Pots are virtual: the rider has one real savings pocket, and Coinvoy tracks how its money is earmarked.
// Balances move only when the rider confirms a transfer ("Dah pindah"), so they reflect money that really moved.
import { eq } from 'drizzle-orm'
import { type Db, schema } from '../db/index.ts'

export const POT_KINDS = ['penampan', 'cuti', 'kecemasan', 'motor', 'raya', 'isaraan', 'perkeso'] as const
export type PotKind = (typeof POT_KINDS)[number]
export type Pot = typeof schema.pots.$inferSelect
type Transfer = typeof schema.transfers.$inferSelect

export async function ensurePots(db: Db, userId: number): Promise<Record<PotKind, Pot>> {
  await db
    .insert(schema.pots)
    .values(POT_KINDS.map((kind) => ({ userId, kind })))
    .onConflictDoNothing()
  const rows = await db.select().from(schema.pots).where(eq(schema.pots.userId, userId))
  return Object.fromEntries(rows.map((p) => [p.kind, p])) as Record<PotKind, Pot>
}

/**
 * Split a confirmed amount (same sign as fullSen) across pots.
 * Money in fills the earmarked pots first (Cuti for Raya, i-Saraan) and the Penampan gets the rest, so a partial
 * transfer protects the plans the rider made. Money out comes out proportionally. The parts always add up exactly.
 */
export function allocate(allocation: Record<string, number>, fullSen: number, confirmedSen: number): Record<string, number> {
  if (fullSen === 0 || confirmedSen === 0) return {}
  const others = Object.entries(allocation).filter(([k, v]) => k !== 'penampan' && v)
  const out: Record<string, number> = {}
  if (fullSen > 0) {
    let left = confirmedSen
    for (const [kind, want] of others) {
      const take = want > 0 ? Math.min(want, left) : want // a negative part (Cuti paying out) always applies
      out[kind] = take
      left -= take
    }
    out.penampan = left
  } else {
    const ratio = confirmedSen / fullSen
    for (const [kind, v] of others) out[kind] = Math.round(v * ratio)
    out.penampan = confirmedSen - Object.values(out).reduce((a, b) => a + b, 0)
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v))
}

const signed = (t: Pick<Transfer, 'direction'>, amount: number) => (t.direction === 'in' ? amount : -amount)

/** confirmedAbsSen null = the full amount ("Dah pindah"); a number = "Bahagian sahaja" (partial). */
export async function confirmTransfer(db: Db, t: Transfer, confirmedAbsSen: number | null): Promise<Transfer> {
  const full = signed(t, t.amountSen)
  const amount = confirmedAbsSen ?? t.amountSen
  const pots = await ensurePots(db, t.userId)
  const deltas: Record<string, number> = {}
  if (t.status === 'confirmed' || t.status === 'partial') {
    // re-confirming replaces the earlier amount, never double counts
    for (const [k, v] of Object.entries(allocate(t.allocation, full, signed(t, t.confirmedAmountSen ?? 0)))) deltas[k] = (deltas[k] ?? 0) - v
  }
  for (const [k, v] of Object.entries(allocate(t.allocation, full, signed(t, amount)))) deltas[k] = (deltas[k] ?? 0) + v
  for (const [kind, delta] of Object.entries(deltas)) {
    const pot = pots[kind as PotKind]
    if (pot && delta) await db.update(schema.pots).set({ balanceSen: pot.balanceSen + delta }).where(eq(schema.pots.id, pot.id))
  }
  const [updated] = await db
    .update(schema.transfers)
    .set({ confirmedAmountSen: amount, status: amount >= t.amountSen ? 'confirmed' : 'partial', confirmedAt: new Date() })
    .where(eq(schema.transfers.id, t.id))
    .returning()
  await db.insert(schema.events).values({ userId: t.userId, name: 'transfer_confirmed', props: { amount_sen: amount, direction: t.direction } })
  return updated!
}
