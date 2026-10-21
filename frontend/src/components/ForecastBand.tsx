import { useI18n } from '../i18n/t'
import { formatRM } from '../lib/money'

// A range bar, not a fan chart: slow week · usual · busy week (design-system §6.6, §10). No axis jargon.
// With `last`, last week's real earnings sit on the same bar so the rider sees where it landed.
export function ForecastBand({ low, mid, high, last }: { low: number; mid: number; high: number; last?: number }) {
  const { t } = useI18n()
  const span = Math.max(high - low, 1)
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - low) / span) * 100))
  const midPct = pct(mid)
  const summary = t('band.summary', { low: formatRM(low, { whole: true }), mid: formatRM(mid, { whole: true }), high: formatRM(high, { whole: true }) })
  return (
    <section aria-labelledby="band-title" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 id="band-title" className="font-semibold">
        {t('band.title')}
      </h2>
      {last === undefined ? (
        <p className="text-sm text-muted">{summary}</p>
      ) : (
        <p className="text-sm text-muted">{t('band.last', { last: formatRM(last, { whole: true }), mid: formatRM(mid, { whole: true }) })}</p>
      )}
      <div className="relative mx-2 h-3" role="img" aria-label={summary}>
        <div className="absolute inset-0 rounded-full bg-brand" />
        <div className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full bg-text" style={{ left: `${midPct}%` }} />
        {last !== undefined && (
          <div className="absolute top-1/2 size-4 -translate-1/2 rounded-full border-[3px] border-surface bg-[var(--info)]" style={{ left: `${pct(last)}%` }} title={t('band.lastMark')} />
        )}
      </div>
      <div className="flex justify-between text-sm tabular-nums">
        <span>
          <span className="block text-[0.8125rem] text-muted">{t('band.low')}</span>
          <b>{formatRM(low, { whole: true })}</b>
        </span>
        <span className="text-center">
          <span className="block text-[0.8125rem] text-muted">{t('band.mid')}</span>
          <b>{formatRM(mid, { whole: true })}</b>
        </span>
        <span className="text-right">
          <span className="block text-[0.8125rem] text-muted">{t('band.high')}</span>
          <b>{formatRM(high, { whole: true })}</b>
        </span>
      </div>
    </section>
  )
}
