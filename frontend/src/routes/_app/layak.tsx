import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Calculator, FileText } from 'lucide-react'
import { useState } from 'react'
import { ResultPlaceholder } from '../../components/EmptyState'
import { MoneyField } from '../../components/MoneyField'
import { RiskBadge } from '../../components/RiskBadge'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useI18n } from '../../i18n/t'
import { api, errorText, penyataQuery, prefetch, type Risk } from '../../lib/api'
import { formatRM } from '../../lib/money'

type Layak = { item: string; loanSen: number; interestSen: number; monthlySen: number; totalSen: number; effectivePctYear: number; salarySen: number; newSalarySen: number; pSafe: number; risk: Risk }

export const Route = createFileRoute('/_app/layak')({ loader: prefetch(penyataQuery), component: SemakLayak })

// Semak Layak: what an instalment does to the rider's own future weeks. A risky answer is shown as
// plainly as a safe one, and Coinvoy earns the same either way.
function SemakLayak() {
  const { t, lang } = useI18n()
  const penyata = useQuery(penyataQuery)
  const [item, setItem] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [deposit, setDeposit] = useState<number | null>(null)
  const [months, setMonths] = useState(12)
  const [rate, setRate] = useState('8')
  const check = useMutation({
    mutationFn: () => api<Layak>('/api/layak', { body: { item: item.trim() || t('layak.itemDefault'), priceSen: price, depositSen: deposit ?? 0, months, flatRatePct: Number(rate) || 0 } }),
  })
  const r = check.data
  const rm = (sen: number) => formatRM(sen, { whole: true })
  return (
    <>
      <ScreenHeader title={t('layak.title')} back />
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <form className="flex flex-col gap-4 rounded-lg border-2 border-outline bg-surface p-5" onSubmit={(e) => { e.preventDefault(); if (price) check.mutate() }}>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('layak.item')}
            <input value={item} onChange={(e) => setItem(e.target.value)} placeholder={t('layak.itemPlaceholder')} maxLength={40} className="h-12 rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 px-3 text-base font-normal" />
          </label>
          <MoneyField label={t('layak.price')} valueSen={price} onChange={setPrice} required />
          <MoneyField label={t('layak.deposit')} valueSen={deposit} onChange={setDeposit} />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {t('layak.months')}
              <input type="number" inputMode="numeric" min={1} max={120} value={months} onChange={(e) => setMonths(Math.min(120, Math.max(1, Number(e.target.value) || 1)))} className="h-12 rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 px-3 text-base font-normal tabular-nums" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {t('layak.rate')}
              <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} className="h-12 rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 px-3 text-base font-normal tabular-nums" />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!price || check.isPending}>{t('layak.check')}</button>
          {check.isError && <p role="alert" className="text-sm font-semibold text-[var(--risky)]">{errorText(check.error, lang, t('common.tryAgain'))}</p>}
        </form>

        {!r && <ResultPlaceholder icon={Calculator} body={t('common.resultHere')} />}
        {r && (
          <section aria-live="polite" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
            <RiskBadge risk={r.risk} pSafe={r.pSafe} />
            <p className="text-lg font-medium">{t(`layak.verdict.${r.risk}`, { item: r.item })}</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted">{t('layak.monthly')}</dt><dd className="text-right font-bold tabular-nums">{formatRM(r.monthlySen)}</dd>
              <dt className="text-muted">{t('layak.interest')}</dt><dd className="text-right tabular-nums">{formatRM(r.interestSen)}</dd>
              <dt className="text-muted">{t('layak.flatVsReal')}</dt><dd className="text-right tabular-nums">{rate}% → {r.effectivePctYear}%</dd>
              <dt className="text-muted">{t('layak.salary')}</dt><dd className="text-right tabular-nums">{rm(r.salarySen)} → <b>{rm(r.newSalarySen)}</b></dd>
            </dl>
            <p className="text-[0.8125rem] text-muted">{t('layak.flatNote')}</p>
            <p className="text-[0.8125rem] text-muted">{t('layak.sameEarn')}</p>
            {penyata.data?.unlocked && (
              <Link to="/rekod" className="btn btn-secondary"><FileText size={18} aria-hidden /> {t('layak.surat')}</Link>
            )}
          </section>
        )}
      </div>
      <p className="text-[0.8125rem] text-muted">{t('common.disclaimer')}</p>
    </>
  )
}
