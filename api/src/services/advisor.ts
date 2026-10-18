// Semak Layak (FR-ADV-5) and the lender check (FR-ADV-6). The LLM only reads the pasted offer; matching the
// BNM alert list, checking the rate cap and wording the result are plain code.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const DATA = fileURLToPath(new URL('../../data', import.meta.url))
const latest = readdirSync(DATA).filter((f) => /^fca_list_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1)!
const FCA = JSON.parse(readFileSync(`${DATA}/${latest}`, 'utf8')) as { downloaded: string; source: string; entries: { name: string; website: string | null; added: string }[] }

// Moneylenders Act 1951 (as amended): 12% a year with security, 18% without. VERIFY before the pitch (PRD §10).
export const RATE_CAP = { securedPctYear: 12, unsecuredPctYear: 18 }

const STOP = /\b(sdn|bhd|berhad|plt|enterprise|ent|resources|potential|clone|entity|the|and|dan|\d{5,}[a-z]?)\b/g
export const normalise = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim()
const NORMALISED = FCA.entries.map((e) => ({ ...e, key: normalise(e.name), host: hostOf(e.website) }))

function hostOf(text: string | null): string | null {
  const m = text?.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\/[^\s]*)?/i)
  if (!m) return null
  const host = m[1]!.toLowerCase()
  // Social links aren't an identity: two pages on facebook.com are different entities.
  return /^(t\.me|wa\.me|facebook\.com|m\.facebook\.com|instagram\.com|tiktok\.com|bit\.ly)$/.test(host) ? (m[0]!.toLowerCase().replace(/^https?:\/\/(www\.)?/, '')) : host
}

/** An exact name match (after normalising) or a shared website. Never a vague similarity: a false match defames. */
export function fcaMatch(name: string | null, text: string) {
  const key = name ? normalise(name) : ''
  const urls = [...text.matchAll(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/gi)].map((m) => hostOf(m[0])).filter(Boolean)
  const hit = NORMALISED.find((e) => (key.length >= 4 && e.key === key) || (e.host && urls.includes(e.host)))
  return { matched: Boolean(hit), name: hit?.name ?? null, added: hit?.added ?? null, listDate: FCA.downloaded, source: FCA.source }
}

const RULES: [string, RegExp][] = [
  ['upfront_fee', /\b(bayar dulu|deposit|yuran (proses|guaman|setem)|processing fee|duit pendahuluan|fee dulu|bayaran awal)\b/i],
  ['no_ctos_claim', /\b(tanpa|no|tak perlu|x perlu)\s+(ctos|ccris)\b|blacklist(ed)? (pun )?(ok|boleh|lulus)|senarai hitam (pun )?boleh/i],
  ['whatsapp_only', /\b(whatsapp|wasap|wassap|wa\.me)\b/i],
  ['instant', /\b(lulus segera|lulus dalam \d+ (minit|jam)|instant approval|tanpa dokumen|no documents?)\b/i],
]
const RATE = /(\d+(?:\.\d+)?)\s*%\s*(sebulan|per month|\/month|a month|bulanan|setahun|per year|\/year|a year|p\.?\s?a\.?|tahunan)/i

export const LlmOffer = z.object({
  lender_name: z.string().max(120).nullable().default(null),
  phone: z.string().max(40).nullable().default(null),
  stated_rate_pct: z.number().min(0).max(1000).nullable().default(null),
  rate_period: z.enum(['month', 'year']).nullable().default(null),
  upfront_fee: z.boolean().default(false),
  no_ctos_claim: z.boolean().default(false),
  whatsapp_only: z.boolean().default(false),
  red_flags: z.array(z.string().max(120)).max(5).default([]),
})
export type LlmOffer = z.infer<typeof LlmOffer>

export function checkOffer(text: string, llm: LlmOffer | null) {
  const flags = new Set(RULES.filter(([, re]) => re.test(text)).map(([k]) => k))
  if (llm?.upfront_fee) flags.add('upfront_fee')
  if (llm?.no_ctos_claim) flags.add('no_ctos_claim')
  if (llm?.whatsapp_only) flags.add('whatsapp_only')
  const m = text.match(RATE)
  const pct = m ? Number(m[1]) : llm?.stated_rate_pct ?? null
  const period = m ? (/bulan|month/i.test(m[2]!) ? 'month' : 'year') : llm?.rate_period ?? null
  const yearly = pct === null ? null : period === 'month' ? pct * 12 : pct
  const overCap = yearly !== null && yearly > RATE_CAP.unsecuredPctYear
  if (overCap) flags.add('rate_over_cap')
  const fca = fcaMatch(llm?.lender_name ?? null, text)
  const level = fca.matched || flags.has('upfront_fee') || overCap ? 'tinggi' : flags.size ? 'sederhana' : 'rendah'
  return { level, flags: [...flags], extraFlags: llm?.red_flags ?? [], fca, rate: { pct, period, yearlyPct: yearly, capPct: RATE_CAP.unsecuredPctYear, overCap }, lenderName: llm?.lender_name ?? null }
}

/** Monthly instalment on a flat rate, and the real (effective) yearly rate it amounts to. */
export function instalment(priceSen: number, depositSen: number, months: number, flatPctYear: number) {
  const loan = Math.max(0, priceSen - depositSen)
  const interest = Math.round(loan * (flatPctYear / 100) * (months / 12))
  const monthly = Math.ceil((loan + interest) / months)
  // Effective rate: the monthly r where an amortising loan has the same payment (bisection).
  let lo = 0
  let hi = 1
  for (let i = 0; i < 60 && loan > 0 && interest > 0; i++) {
    const r = (lo + hi) / 2
    const pay = (loan * r) / (1 - (1 + r) ** -months)
    if (pay > monthly) hi = r
    else lo = r
  }
  return { loanSen: loan, interestSen: interest, monthlySen: monthly, totalSen: loan + interest + depositSen, effectivePctYear: Math.round(lo * 12 * 1000) / 10 }
}
