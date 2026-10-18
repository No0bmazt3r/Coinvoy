import type { Key } from '../i18n/t'
import type { Salary } from './api'
import { formatRM } from './money'

/** "Turun RM30: ansuran motor minggu depan." from the engine's top factor (FR-ENG-6). */
export function explanation(s: Salary, t: (k: Key, v?: Record<string, string | number>) => string): string {
  const f = s.factors[0]
  if (!f || f.key === 'first') return s.coldStart ? t('gaji.why.coldStart') : t('gaji.why.first', { n: s.weeksUsed })
  if (f.key === 'steady' || !s.salaryDeltaSen) return t('gaji.why.steady')
  const dir = s.salaryDeltaSen > 0 ? 'up' : 'down'
  const amount = formatRM(Math.abs(s.salaryDeltaSen), { whole: true })
  const reason =
    f.key === 'bills' && f.names?.length ? t('gaji.why.billNamed', { name: f.names.join(', ') }) : f.key === 'mixed' ? t('gaji.why.mixed') : t(`gaji.why.${f.key}.${dir}` as Key)
  return t(`gaji.why.${dir}`, { amount, reason })
}
