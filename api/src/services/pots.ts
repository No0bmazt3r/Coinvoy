// Pots are virtual: the rider has one real savings pocket, and Coinvoy tracks how its money is earmarked.
// Balances move only when the rider confirms a transfer ("Dah pindah"), so they reflect money that really moved.
import { and, asc, eq, inArray } from 'drizzle-orm'
import { type Db, schema } from '../db/index.ts'
import { ApiError } from '../errors.ts'

export const POT_KINDS = ['penampan', 'cuti', 'kecemasan', 'motor', 'raya', 'isaraan', 'perkeso'] as const
export type PotKind = (typeof POT_KINDS)[number]
export type Pot = typeof schema.pots.$inferSelect
type Transfer = typeof schema.transfers.$inferSelect

/** Pots the rider can add from the "+" sheet. Penampan and PERKESO are always there. */
export const ADDABLE = ['kecemasan', 'motor', 'raya', 'cuti', 'isaraan'] as const
export const CUSTOM_ICONS = ['briefcase', 'users', 'bike', 'gift', 'home', 'phone', 'graduation', 'heart', 'plane', 'piggy'] as const
export const MAX_POTS = 10 // open pots besides the buffer, like GXBank's cap
const ALWAYS_ON = new Set<string>(['penampan', 'perkeso'])


/** Every pot row, built-ins first created "not added yet". Custom pots (kind c-…) are included under their own kind. */
export async function ensurePots(db: Db, userId: number): Promise<Record<PotKind, Pot> & Record<string, Pot>> {
  await db
    .insert(schema.pots)
    .values(POT_KINDS.map((kind) => ({ userId, kind, active: ALWAYS_ON.has(kind) })))
    .onConflictDoNothing()
  const rows = await db.select().from(schema.pots).where(eq(schema.pots.userId, userId))
  return Object.fromEntries(rows.map((p) => [p.kind, p])) as Record<PotKind, Pot> & Record<string, Pot>
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

/**
 * The Penampan balance after each confirmed transfer, oldest first (the last 12).
 * Nothing stores past balances, so this counts back from today's balance through each transfer's Penampan share.
 */
export async function penampanHistory(db: Db, userId: number): Promise<{ weekStart: string; balanceSen: number }[]> {
  const pots = await ensurePots(db, userId)
  const ts = await db
    .select()
    .from(schema.transfers)
    .where(and(eq(schema.transfers.userId, userId), inArray(schema.transfers.status, ['confirmed', 'partial'])))
    .orderBy(asc(schema.transfers.weekStart))
  let balance = pots.penampan.balanceSen
  const out: { weekStart: string; balanceSen: number }[] = []
  for (const t of ts.reverse()) {
    out.push({ weekStart: t.weekStart, balanceSen: balance })
    balance -= allocate(t.allocation, signed(t, t.amountSen), signed(t, t.confirmedAmountSen ?? 0)).penampan ?? 0
  }
  return out.slice(0, 12).reverse()
}

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

const tooMany = () => new ApiError(409, 'pot_limit', `Had ${MAX_POTS} poket dicapai. Tutup satu dahulu.`, `You can have ${MAX_POTS} pots. Close one first.`)

/** Add a suggested built-in, or the rider's own pot (name + icon). Returns the pot. */
export async function addPot(db: Db, userId: number, p: { kind?: string; name?: string; icon?: string; targetSen: number; weeklySen: number }): Promise<Pot> {
  const pots = await ensurePots(db, userId)
  if (Object.values(pots).filter((x) => x.active && !ALWAYS_ON.has(x.kind)).length >= MAX_POTS) throw tooMany()
  const values = { active: true, targetSen: p.targetSen, weeklySen: p.weeklySen }
  if (p.kind) {
    const pot = pots[p.kind]
    if (!pot || !(ADDABLE as readonly string[]).includes(p.kind)) throw new ApiError(400, 'bad_pot', 'Poket tidak sah.', 'Not a valid pot.')
    const [updated] = await db.update(schema.pots).set(values).where(eq(schema.pots.id, pot.id)).returning()
    return updated!
  }
  const [created] = await db.insert(schema.pots).values({ userId, kind: `c-${Date.now().toString(36)}`, name: p.name, icon: p.icon, ...values }).returning()
  return created!
}

/** Close a pot: its money moves to Penampan, and the pot is kept as history. */
export async function closePot(db: Db, userId: number, kind: string): Promise<{ movedSen: number }> {
  const pots = await ensurePots(db, userId)
  const pot = pots[kind]
  if (!pot || ALWAYS_ON.has(kind)) throw new ApiError(400, 'bad_pot', 'Poket ini tidak boleh ditutup.', "This pot can't be closed.")
  await db.transaction(async (tx) => {
    await tx.update(schema.pots).set({ balanceSen: pots.penampan.balanceSen + pot.balanceSen }).where(eq(schema.pots.id, pots.penampan.id))
    await tx.update(schema.pots).set({ active: false, balanceSen: 0, weeklySen: 0 }).where(and(eq(schema.pots.id, pot.id), eq(schema.pots.userId, userId)))
  })
  return { movedSen: pot.balanceSen }
}


