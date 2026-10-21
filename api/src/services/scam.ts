// Semak Mesej: looks for the warning signs riders actually get in SMS and WhatsApp, like fake "akaun disekat" links,
// TAC requests, fake parcels or jobs, people renting bank accounts, and fake police calls.
// Our rules (BM, English and Manglish) decide the risk level. The AI can only add extra signs.

type Flag = { key: string; high: boolean; re: RegExp }

// One warning sign each. `high` means this sign alone is enough for high risk.
const FLAGS: Flag[] = [
  { key: 'asks_code', high: true, re: /\b(tac|otp|pin|kata ?laluan|password|kod (pengesahan|keselamatan|rahsia|6 digit|enam digit)|verification code|security code)\b/i },
  { key: 'apk', high: true, re: /\.apk\b|\b(muat ?turun|download|install|pasang) (aplikasi|app|apps|fail)\b/i },
  { key: 'mule', high: true, re: /\b(sewa|jual|pinjam|beli) (akaun|account)|\brent (your |a )?(bank )?account|\b(akaun|account) (bank )?(untuk )?(disewa|dijual)|\bterima (duit|wang) (bagi pihak|untuk orang)/i },
  { key: 'authority', high: true, re: /\b(polis|pdrm|lhdn|hasil|mahkamah|bank negara|bnm|kastam|sprm|macc|court|police)\b[\s\S]{0,60}\b(saman|tangkap|ditangkap|siasat|disiasat|waran|warrant|arrest|terlibat|pengubahan wang|money laundering)\b/i },
  { key: 'pay_first', high: true, re: /\b(bayar|pay|transfer|pindah)\b[\s\S]{0,25}\b(dulu|dahulu|first|cukai|tax|caj|fee|fi|deposit|kos penghantaran|shipping fee|untuk (tuntut|claim|terima))\b/i },
  { key: 'account_blocked', high: false, re: /\b(akaun|account|kad|card)\b[\s\S]{0,25}\b(disekat|dibekukan|digantung|ditutup|tamat|blocked|suspended|frozen|locked|deactivated|expired)\b/i },
  { key: 'urgent', high: false, re: /\b(segera|sekarang juga|hari ini (sahaja|je)|dalam (masa )?\d+ ?(minit|jam)|urgent|immediately|right now|within \d+ ?(minutes|hours)|last chance|peluang terakhir|cepat)\b/i },
  { key: 'prize', high: false, re: /\b(tahniah|anda (telah )?(menang|terpilih)|hadiah|congratulations|you('ve| have)? won|winner|cabutan bertuah|lucky draw|baucar percuma|free voucher)\b/i },
  { key: 'job_offer', high: false, re: /\b(kerja (sambilan|dari rumah|mudah)|part[- ]?time|work from home|like (dan|&|and) follow|tugasan (mudah|online)|simple tasks?|gaji rm ?\d+ (sehari|setiap hari)|earn rm ?\d+ (a|per) day)\b/i },
  { key: 'short_link', high: false, re: /\b(bit\.ly|tinyurl\.com|t\.co|s\.id|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|is\.gd|t\.ly)\//i },
]

// Official sites of what riders use. A link that names one of these brands on any other site is a lookalike.
const OFFICIAL: Record<string, string[]> = {
  grab: ['grab.com'],
  foodpanda: ['foodpanda.my', 'foodpanda.com'],
  shopee: ['shopee.com.my', 'shopee.com'],
  lalamove: ['lalamove.com'],
  maybank: ['maybank2u.com.my', 'maybank.com', 'maybank.com.my'],
  cimb: ['cimbclicks.com.my', 'cimb.com.my', 'cimb.com'],
  publicbank: ['publicbank.com.my', 'pbebank.com'],
  rhb: ['rhbgroup.com', 'rhbnow.com'],
  bankislam: ['bankislam.com', 'bankislam.com.my'],
  bsn: ['bsn.com.my', 'mybsn.com.my'],
  touchngo: ['tngdigital.com.my', 'touchngo.com.my'],
  kwsp: ['kwsp.gov.my'],
  perkeso: ['perkeso.gov.my'],
  lhdn: ['hasil.gov.my'],
  pdrm: ['rmp.gov.my'],
}
const BRAND_ALIASES: Record<string, string> = { tng: 'touchngo', epf: 'kwsp', socso: 'perkeso', hasil: 'lhdn', m2u: 'maybank' }
// 0→o, 1→l, 3→e, 4→a, 5→s: "gr4b", "sh0pee", "may8ank" style swaps
const unleet = (s: string) => s.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/8/g, 'b')
const URL_RE = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:\/[^\s)]*)?/gi
const IP_RE = /\bhttps?:\/\/\d{1,3}(?:\.\d{1,3}){3}/i
// Malaysian mobile numbers: 01x-xxx xxxx, +601x…
const PHONE_RE = /(?:\+?6)?01\d[- ]?\d{3,4}[- ]?\d{4}\b/g

export type Link = { host: string; official: boolean; lookalikeOf: string | null }
export type ScamCheck = { level: 'tinggi' | 'sederhana' | 'rendah'; flags: string[]; links: Link[]; phones: string[] }

export function checkLink(host: string): Link {
  const h = host.toLowerCase().replace(/^www\./, '')
  for (const domains of Object.values(OFFICIAL)) if (domains.some((d) => h === d || h.endsWith(`.${d}`))) return { host: h, official: true, lookalikeOf: null }
  if (h.endsWith('.gov.my')) return { host: h, official: true, lookalikeOf: null }
  const flat = unleet(h.replace(/[-.]/g, ''))
  const brand = Object.keys(OFFICIAL).find((b) => flat.includes(b)) ?? Object.entries(BRAND_ALIASES).find(([a]) => new RegExp(`(^|[-.])${a}([-.]|$)`).test(h))?.[1] ?? null
  return { host: h, official: false, lookalikeOf: brand }
}

/** The rule-based check. Pure, so it's tested directly. */
export function checkMessage(text: string): ScamCheck {
  const flags = new Set(FLAGS.filter((f) => f.re.test(text)).map((f) => f.key))
  const links = [...new Map([...text.matchAll(URL_RE)].map((m) => [m[1]!.toLowerCase(), checkLink(m[1]!)])).values()]
    .filter((l) => /\.[a-z]{2,}$/.test(l.host) && !/^\d+(\.\d+)+$/.test(l.host)) // a bare "RM12.50" isn't a site
  if (links.some((l) => l.lookalikeOf)) flags.add('lookalike_link')
  if (IP_RE.test(text)) flags.add('ip_link')
  const high = new Set(['lookalike_link', 'ip_link', ...FLAGS.filter((f) => f.high).map((f) => f.key)])
  const phones = [...new Set([...text.matchAll(PHONE_RE)].map((m) => m[0].replace(/[- ]/g, '')))]
  const list = [...flags]
  return { level: list.some((f) => high.has(f)) ? 'tinggi' : list.length ? 'sederhana' : 'rendah', flags: list, links, phones }
}
