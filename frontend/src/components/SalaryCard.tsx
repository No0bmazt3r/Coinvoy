import { useEffect, useState } from 'react'
import { RiskBadge } from './RiskBadge'
import { TransferInstruction } from './TransferInstruction'
import { useI18n } from '../i18n/t'
import type { Salary, Transfer } from '../lib/api'
import { explanation } from '../lib/explain'
import { formatRM } from '../lib/money'

const LAST_SEEN = 'coinvoy.lastSalary'

// The number counts up once when it changes, never on every load (design-system §8).
function useCountUp(target: number): number {
  const [shown, setShown] = useState(() => {
    try {
      const last = Number(localStorage.getItem(LAST_SEEN))
      return Number.isFinite(last) && last > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches ? last : target
    } catch {
      return target
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(LAST_SEEN, String(target))
    } catch {
      // storage blocked: it just won't animate next time
    }
    if (shown === target) return
    const from = shown
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min((now - start) / 400, 1)
      setShown(Math.round(from + (target - from) * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate only when the target changes
  }, [target])
  return shown
}

export function SalaryCard({ salary, transfer }: { salary: Salary; transfer: Transfer | null }) {
  const { t } = useI18n()
  const shown = useCountUp(salary.salarySen)
  const b = salary.buildUp
  return (
    <section aria-labelledby="salary-label" className="overflow-hidden rounded-[var(--radius-lg)] border-2 border-outline bg-brand text-on-brand">
      <div data-tour="salary" className="flex flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="salary-label" className="text-base font-semibold">
            {t('gaji.cardLabel')}
          </h2>
          <span data-tour="risk" className="rounded-full bg-surface">
            <RiskBadge risk={salary.risk} />
          </span>
        </div>
        <p className="text-[3.5rem] leading-[3.75rem] font-extrabold tracking-[-0.02em] tabular-nums" aria-live="polite">
          {formatRM(shown, { whole: true })}
        </p>
        <p className="text-lg leading-[1.625rem] font-medium">{explanation(salary, t)}</p>
        {salary.coldStart && <p className="text-[0.8125rem] font-medium opacity-80">{t('gaji.estimateLabel')}</p>}
        {b && (
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex justify-between text-sm font-semibold tabular-nums">
              <span>{t('gaji.buildUp.label')}</span>
              <span>
                {formatRM(b.bufferSen, { whole: true })} / {formatRM(b.targetSen, { whole: true })}
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-on-brand/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={b.targetSen}
              aria-valuenow={Math.max(b.bufferSen, 0)}
              aria-label={t('gaji.buildUp.label')}
            >
              <div className="h-full rounded-full bg-on-brand" style={{ width: `${Math.min(100, Math.max(0, (b.bufferSen / b.targetSen) * 100))}%` }} />
            </div>
            {b.per100Sen > 0 && <p className="text-sm">{t('gaji.buildUp.per100', { amount: formatRM(b.per100Sen, { whole: true }) })}</p>}
          </div>
        )}
      </div>
      {transfer && <TransferInstruction transfer={transfer} />}
    </section>
  )
}
