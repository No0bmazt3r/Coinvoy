import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight, FileCheck2, HeartPulse, Landmark, Loader2, Palmtree, PiggyBank, Shield, Siren, Bike, Moon, type LucideIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { MoneyField } from '../../components/MoneyField'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { Skeleton } from '../../components/Skeleton'
import { useI18n, type Key } from '../../i18n/t'
import { api, carumanQuery, errorText, type Pot, potsQuery } from '../../lib/api'
import { formatRM } from '../../lib/money'

export const Route = createFileRoute('/_app/tabung')({ component: Tabung })

const ICON: Record<string, LucideIcon> = { penampan: Shield, cuti: Palmtree, kecemasan: Siren, motor: Bike, raya: Moon, isaraan: Landmark, perkeso: HeartPulse }

// Pots are earmarks inside the rider's one real savings pocket; balances move only on "Dah pindah" (FR-CAR-*).
// Desktop: the pots on the left, government contributions and the cross-check on the right.
function Tabung() {
  const { t } = useI18n()
  const pots = useQuery(potsQuery)
  const caruman = useQuery(carumanQuery)
  const [editing, setEditing] = useState<Pot | null>(null)
  const [contributing, setContributing] = useState(false)
  const rm = (sen: number) => formatRM(sen, { whole: true })

  if (pots.isPending || caruman.isPending) return <><ScreenHeader title={t('tabung.title')} /><Skeleton className="h-96" /></>
  if (pots.isError || caruman.isError) return <><ScreenHeader title={t('tabung.title')} /><ErrorState error={pots.error ?? caruman.error} onRetry={() => { pots.refetch(); caruman.refetch() }} /></>
  const c = caruman.data
  const shown = pots.data.filter((p) => p.kind !== 'perkeso' || !c.perkeso.deductedAtSource)
  const total = shown.reduce((a, p) => a + p.balanceSen, 0)
  const isaraanPct = Math.min(100, (c.isaraan.paidYearSen / c.isaraan.fullMatchNeedsSen) * 100)

  return (
    <>
      <ScreenHeader title={t('tabung.title')} />
      <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <div className="col">
          <section className="flex flex-col gap-1 rounded-lg border-2 border-outline bg-surface p-5">
            <p className="text-sm font-semibold text-muted">{t('tabung.total')}</p>
            <p className="text-[2rem] leading-[2.375rem] font-extrabold tabular-nums">{rm(total)}</p>
            <p className="text-sm text-muted">{t('tabung.onePocket')}</p>
          </section>
          <ul className="flex flex-col gap-2 max-lg:order-1">
            {shown.map((p) => {
              const Icon = ICON[p.kind] ?? PiggyBank
              const pct = p.targetSen ? Math.min(100, (p.balanceSen / p.targetSen) * 100) : 0
              return (
                <li key={p.kind}>
                  <button type="button" onClick={() => setEditing(p)} className="pressable flex w-full flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-left hover:bg-surface-2">
                    <span className="flex w-full items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2"><Icon size={20} aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{t(`pot.${p.kind}` as Key)}</span>
                        <span className="block text-sm text-muted">{t(`pot.${p.kind}.what` as Key)}</span>
                      </span>
                      <span className="text-right tabular-nums">
                        <b className="block">{rm(p.balanceSen)}</b>
                        {p.targetSen > 0 && <span className="block text-[0.8125rem] text-muted">/ {rm(p.targetSen)}</span>}
                      </span>
                    </span>
                    {p.targetSen > 0 && (
                      <span className="block h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                      </span>
                    )}
                    {p.weeklySen > 0 && <span className="text-[0.8125rem] text-muted">{t('pot.weekly', { amount: rm(p.weeklySen) })}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="col">
          <section aria-labelledby="govt" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="govt" className="font-semibold">{t('caruman.claimed')}</h2>
                <p className="text-sm text-muted">{t('caruman.claimedBody')}</p>
              </div>
              <p className="text-2xl font-extrabold text-brand-text tabular-nums">{rm(c.governmentClaimedSen)}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm tabular-nums">
                <span>{t('caruman.isaraanProgress')}</span>
                <span>{rm(c.isaraan.paidYearSen)} / {rm(c.isaraan.fullMatchNeedsSen)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(isaraanPct)} aria-label={t('caruman.isaraanProgress')}>
                <div className="h-full rounded-full bg-brand" style={{ width: `${isaraanPct}%` }} />
              </div>
              <p className="text-[0.8125rem] text-muted">
                {t('caruman.isaraanRule', { rate: Math.round(c.isaraan.rate * 100), cap: rm(c.isaraan.capSen), match: rm(c.isaraan.matchYearSen) })}
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setContributing(true)}>
              {t('caruman.record')}
            </button>
            <p className="flex items-center gap-2 text-sm text-muted">
              <HeartPulse size={16} aria-hidden />
              {t(c.perkeso.deductedAtSource ? 'caruman.perkesoDeducted' : 'caruman.perkesoReserve', { rate: (c.perkeso.rate * 100).toFixed(2) })}
            </p>
          </section>
          <Link to="/cuti" className="pressable flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-surface-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand"><Palmtree size={20} aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t('cuti.entryTitle')}</span>
              <span className="block text-sm text-muted">{t('cuti.entryBody')}</span>
            </span>
            <ChevronRight size={20} className="text-muted" aria-hidden />
          </Link>
          <div className="max-lg:order-2">
            <StatementCheck />
          </div>
        </div>
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing ? t(`pot.${editing.kind}` as Key) : ''}>
        {editing && <PotForm pot={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={contributing} onClose={() => setContributing(false)} title={t('caruman.record')}>
        <ContributionForm onDone={() => setContributing(false)} />
      </Sheet>
    </>
  )
}

function PotForm({ pot, onDone }: { pot: Pot; onDone: () => void }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<number | null>(pot.targetSen || null)
  const [weekly, setWeekly] = useState<number | null>(pot.weeklySen || null)
  const save = useMutation({
    mutationFn: () => api(`/api/pots/${pot.kind}`, { method: 'PATCH', body: pot.kind === 'penampan' ? { targetSen: target ?? 0 } : { targetSen: target ?? 0, weeklySen: weekly ?? 0 } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      onDone()
    },
  })
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <MoneyField label={t('pot.target')} valueSen={target} onChange={setTarget} />
      {pot.kind !== 'penampan' && <MoneyField label={t('pot.weeklyLabel')} valueSen={weekly} onChange={setWeekly} hint={t('pot.weeklyHint')} />}
      {save.isError && <p className="text-sm text-[var(--risky)]">{errorText(save.error, lang, t('common.tryAgain'))}</p>}
      <button type="submit" className="btn btn-primary" disabled={save.isPending}>{t('common.save')}</button>
    </form>
  )
}

function ContributionForm({ onDone }: { onDone: () => void }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState<number | null>(null)
  const [match, setMatch] = useState<number | null>(null)
  const save = useMutation({
    mutationFn: () => api<{ matchSen: number }>('/api/caruman/isaraan', { body: { amountSen: amount } }),
    onSuccess: async (r) => {
      setMatch(r.matchSen)
      await queryClient.invalidateQueries()
    },
  })
  if (match !== null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-lg font-semibold">{t('caruman.matchEarned', { amount: formatRM(match) })}</p>
        <button type="button" className="btn btn-primary" onClick={onDone}>{t('common.done')}</button>
      </div>
    )
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (amount) save.mutate() }}>
      <p className="text-sm text-muted">{t('caruman.recordBody')}</p>
      <MoneyField label={t('caruman.amount')} valueSen={amount} onChange={setAmount} required autoFocus />
      {save.isError && <p className="text-sm text-[var(--risky)]">{errorText(save.error, lang, t('common.tryAgain'))}</p>}
      <button type="submit" className="btn btn-primary" disabled={!amount || save.isPending}>{t('common.save')}</button>
    </form>
  )
}

// Decisions P1: the buffer and weeks earn "Disemak silang" when a statement backs them. The PDF is never kept.
function StatementCheck() {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const check = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api<{ weeksChecked: number; transfersChecked: number; entriesFound: number }>('/api/statement', { form })
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
  return (
    <section aria-labelledby="crosscheck" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 id="crosscheck" className="flex items-center gap-2 font-semibold"><FileCheck2 size={18} aria-hidden /> {t('statement.title')}</h2>
      <p className="text-sm text-muted">{t('statement.body')}</p>
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) check.mutate(f) }} />
      <button type="button" className="btn btn-secondary" disabled={check.isPending} onClick={() => input.current?.click()}>
        {check.isPending ? <Loader2 size={18} className="spin" aria-hidden /> : null}
        {t('statement.upload')}
      </button>
      {check.isSuccess && <p role="status" className="text-sm font-semibold">{t('statement.result', { weeks: check.data.weeksChecked, transfers: check.data.transfersChecked })}</p>}
      {check.isError && <p role="alert" className="text-sm text-[var(--risky)]">{errorText(check.error, lang, t('common.tryAgain'))}</p>}
    </section>
  )
}
