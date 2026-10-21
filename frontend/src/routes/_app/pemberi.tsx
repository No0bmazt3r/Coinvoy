import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { OctagonAlert, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { ResultPlaceholder } from '../../components/EmptyState'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useI18n, type Key } from '../../i18n/t'
import { api, errorText } from '../../lib/api'

type Result = {
  level: 'tinggi' | 'sederhana' | 'rendah'
  flags: string[]
  extraFlags: string[]
  fca: { matched: boolean; name: string | null; added: string | null; listDate: string; source: string }
  rate: { pct: number | null; period: 'month' | 'year' | null; yearlyPct: number | null; capPct: number; overCap: boolean }
  lenderName: string | null
  usedAi: boolean
}

export const Route = createFileRoute('/_app/pemberi')({ component: LenderCheck })

const LOOK = {
  tinggi: { Icon: OctagonAlert, cls: 'bg-[var(--risky-bg)] text-[var(--risky)]' },
  sederhana: { Icon: TriangleAlert, cls: 'bg-[var(--careful-bg)] text-[var(--careful)]' },
  rendah: { Icon: ShieldCheck, cls: 'bg-[var(--safe-bg)] text-[var(--safe)]' },
}

// Lender check: facts, never accusations. "Appears on BNM's alert list (list dated …)", not "scammer".
function LenderCheck() {
  const { t, lang } = useI18n()
  const [text, setText] = useState('')
  const check = useMutation({ mutationFn: () => api<Result>('/api/lender-check', { body: { text } }) })
  const r = check.data
  return (
    <>
      <ScreenHeader title={t('lender.title')} back />
      <p className="text-muted">{t('lender.body')}</p>
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 10) check.mutate() }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={2000} placeholder={t('lender.placeholder')} aria-label={t('lender.placeholder')} className="rounded-[var(--radius-md)] border border-line-strong bg-surface-2 p-3" />
          <button type="submit" className="btn btn-primary" disabled={text.trim().length < 10 || check.isPending}>{t('lender.check')}</button>
          {check.isError && <p role="alert" className="text-sm font-semibold text-[var(--risky)]">{errorText(check.error, lang, t('common.tryAgain'))}</p>}
        </form>
        {!r && <ResultPlaceholder icon={ShieldQuestion} body={t('common.resultHere')} />}
        {r && (() => {
          const { Icon, cls } = LOOK[r.level]
          return (
            <section aria-live="polite" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
              <p className={`flex items-center gap-2 self-start rounded-full px-3 py-1 font-semibold ${cls}`}><Icon size={18} aria-hidden /> {t(`lender.level.${r.level}`)}</p>
              {r.fca.matched ? (
                <p className="font-semibold">{t('lender.onList', { name: r.fca.name ?? '', date: r.fca.listDate, added: r.fca.added ?? '' })}</p>
              ) : (
                <p className="text-sm">{t('lender.notOnList', { date: r.fca.listDate })}</p>
              )}
              {r.flags.length > 0 && (
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                  {r.flags.map((f) => <li key={f}>{t(`lender.flag.${f}` as Key, { pct: r.rate.yearlyPct ?? '', cap: r.rate.capPct })}</li>)}
                  {r.extraFlags.map((f) => <li key={f}>{f}</li>)}
                </ul>
              )}
              <p className="text-sm text-muted">{t('lender.kpkt')}</p>
              <p className="text-[0.8125rem] text-muted">{t(r.usedAi ? 'lender.usedAi' : 'lender.rulesOnly')}</p>
            </section>
          )
        })()}
      </div>
      <p className="text-[0.8125rem] text-muted">{t('common.disclaimer')}</p>
    </>
  )
}
