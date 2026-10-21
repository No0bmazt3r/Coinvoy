// Celik: 30-second lessons triggered by the rider's own data, also Tanya's explain tool.
// Every number in a lesson is computed here, so Tanya can quote it through the number guard.
import { and, eq, gte, ne } from 'drizzle-orm'
import type { User } from '../auth.ts'
import { type Db, schema } from '../db/index.ts'
import { env } from '../env.ts'
import { addWeeks, thisWeek } from '../lib/weeks.ts'
import { ensurePots } from './pots.ts'

export const TOPICS = ['commission', 'buffer', 'flat_vs_effective', 'perkeso', 'isaraan', 'leave'] as const
export type Topic = (typeof TOPICS)[number]
type Lang = 'ms' | 'en'

async function facts(db: Db, user: User) {
  const recent = await db.select().from(schema.earnings).where(and(eq(schema.earnings.userId, user.id), gte(schema.earnings.weekStart, addWeeks(thisWeek(), -4))))
  const gross = recent.reduce((a, e) => a + e.grossSen, 0)
  const commission = recent.reduce((a, e) => a + e.commissionSen, 0)
  const pots = await ensurePots(db, user.id)
  const [leave] = await db
    .select({ id: schema.leavePlans.id })
    .from(schema.leavePlans)
    .where(and(eq(schema.leavePlans.userId, user.id), eq(schema.leavePlans.kind, 'planned'), ne(schema.leavePlans.status, 'cancelled'), gte(schema.leavePlans.startWeek, thisWeek())))
  return {
    commission_pct: gross ? Math.round((commission / gross) * 100) : null,
    buffer_rm: Math.round(pots.penampan.balanceSen / 100),
    target_rm: Math.round((2 * (user.essentialsWeekSen ?? 0)) / 100),
    isaraan_weekly_rm: Math.round(pots.isaraan.weeklySen / 100),
    isaraan_rate_pct: Math.round(env.ISARAAN_MATCH_RATE * 100),
    isaraan_cap_rm: Math.round(env.ISARAAN_MATCH_CAP_SEN / 100),
    perkeso_deducted: env.PERKESO_DEDUCTED_AT_SOURCE,
    leave_planned: Boolean(leave),
  }
}

const TEXT: Record<Topic, Record<Lang, [string, string]>> = {
  commission: {
    ms: ['Komisen platform', 'Bulan ini platform ambil {commission_pct}% daripada pendapatan kasar anda. Bandingkan antara platform: kadar bersih sejam lebih penting daripada jumlah order.'],
    en: ['Platform commission', 'This month the platforms took {commission_pct}% of your gross earnings. Compare platforms by net pay per hour, not number of orders.'],
  },
  buffer: {
    ms: ['Kenapa penampan?', 'Penampan anda RM{buffer_rm}, sasaran RM{target_rm} (2 minggu kos asas). Bila penampan penuh, minggu perlahan tak lagi bermakna gaji jatuh.'],
    en: ['Why a buffer?', "Your buffer is RM{buffer_rm}, the target is RM{target_rm} (2 weeks of basic costs). Once it's full, a slow week no longer means a pay cut."],
  },
  flat_vs_effective: {
    ms: ['Kadar rata vs kadar sebenar', 'Kadar rata dikira atas jumlah asal sepanjang tempoh, walaupun hutang makin kecil. Jadi kadar sebenar hampir dua kali ganda. Semak Layak tunjukkan kedua-duanya.'],
    en: ['Flat vs real rate', 'A flat rate charges interest on the full amount for the whole term, even as the debt shrinks, so the real rate is close to double. Semak Layak shows both.'],
  },
  perkeso: {
    ms: ['PERKESO anda', 'Caruman PERKESO (SKSPS) melindungi anda jika cedera semasa bekerja. {perkeso_line}'],
    en: ['Your PERKESO', "PERKESO (SKSPS) covers you if you're hurt while working. {perkeso_line}"],
  },
  isaraan: {
    ms: ['Duit percuma kerajaan', 'i-Saraan Plus: kerajaan tambah {isaraan_rate_pct}% caruman KWSP anda, sehingga RM{isaraan_cap_rm} setahun. Sekarang anda asingkan RM{isaraan_weekly_rm} seminggu.'],
    en: ['Free government money', 'i-Saraan Plus: the government adds {isaraan_rate_pct}% to your EPF contributions, up to RM{isaraan_cap_rm} a year. You set aside RM{isaraan_weekly_rm} a week now.'],
  },
  leave: {
    ms: ['Cuti berbayar', 'Rancang cuti awal: asingkan sedikit setiap minggu, dan minggu cuti tetap bergaji, dibayar oleh minggu-minggu baik anda.'],
    en: ['Paid leave', 'Plan leave early: set a little aside each week, and your week off still pays, paid for by your good weeks.'],
  },
}
const PERKESO_LINE: Record<Lang, [string, string]> = {
  ms: ['Platform anda sudah memotongnya.', 'Daftar SKSPS di laman PERKESO.'],
  en: ['Your platform already deducts it.', 'Register for SKSPS on the PERKESO site.'],
}

export async function lesson(db: Db, user: User, topic: string, lang: string) {
  const l: Lang = lang === 'en' ? 'en' : 'ms'
  const t: Topic = (TOPICS as readonly string[]).includes(topic) ? (topic as Topic) : 'buffer'
  const f = await facts(db, user)
  const vars: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(f)) vars[k] = v === null ? '?' : (v as string | number)
  vars.perkeso_line = PERKESO_LINE[l][f.perkeso_deducted ? 0 : 1]
  const [title, body] = TEXT[t][l]
  return { topic: t, title, text: body.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '?')) }
}

/** The lessons this rider's data calls for right now (at least one always applies). */
export async function triggered(db: Db, user: User, lang: string) {
  const f = await facts(db, user)
  const topics: Topic[] = []
  if (f.commission_pct !== null && f.commission_pct > 20) topics.push('commission')
  if (f.target_rm && f.buffer_rm < f.target_rm) topics.push('buffer')
  if (f.isaraan_weekly_rm === 0) topics.push('isaraan')
  if (!f.leave_planned) topics.push('leave')
  topics.push('perkeso')
  return Promise.all(topics.map((t) => lesson(db, user, t, lang)))
}
