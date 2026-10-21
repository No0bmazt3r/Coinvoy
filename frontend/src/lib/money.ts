// Money is integer sen everywhere. Floats only ever appear in parseRM's input.

const grouped = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** RM620 (whole, for the salary) or RM1,234.50. Same separators in BM and EN. */
export function formatRM(sen: number, { whole = false, sign = false }: { whole?: boolean; sign?: boolean } = {}): string {
  const neg = sen < 0
  const abs = Math.abs(sen)
  const body = whole ? grouped(Math.round(abs / 100)) : `${grouped(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, '0')}`
  return `${neg ? '-' : sign ? '+' : ''}RM${body}`
}

/** Short money for a chart axis: RM400, RM1.2K. */
export const axisRM = (sen: number) => (sen >= 100_000 ? `RM${+(sen / 100_000).toFixed(1)}K` : `RM${Math.round(sen / 100)}`)

/** "812.50", "RM 1,234", "40" → sen; null if it isn't a plain amount. */
export function parseRM(text: string): number | null {
  const t = text.replace(/rm/i, '').replace(/[,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const [whole, frac = ''] = t.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}
