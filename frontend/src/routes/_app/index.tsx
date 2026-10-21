import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarPlus, Camera, Check, ChevronRight, Landmark, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'
import { BarChart, Legend } from '../../components/Chart'
import { CheckinCard } from '../../components/CheckinCard'
import { Columns } from '../../components/Columns'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { ForecastBand } from '../../components/ForecastBand'
import { GuideButton, GuideHint } from '../../components/Guide'
import { JurangCard } from '../../components/JurangCard'
import { SalaryCard } from '../../components/SalaryCard'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Skeleton } from '../../components/Skeleton'
import { StreakChip } from '../../components/StreakChip'
import { StreakRow } from '../../components/StreakRow'
import { useI18n, type Key } from '../../i18n/t'
import { billsQuery, homeQuery, prefetch, type Week, weeksQuery } from '../../lib/api'
import { shortDate, weekLabel } from '../../lib/dates'
import { axisRM, formatRM } from '../../lib/money'

export const Route = createFileRoute('/_app/')({ loader: prefetch(homeQuery, billsQuery, weeksQuery), component: Gaji })

const STEPS: { icon: LucideIcon; title: Key; body: Key }[] = [
  { icon: Camera, title: 'gaji.step1Title', body: 'gaji.step1Body' },
  { icon: Wallet, title: 'gaji.step2Title', body: 'gaji.step2Body' },
  { icon: PiggyBank, title: 'gaji.step3Title', body: 'gaji.step3Body' },
]

// Home = the salary: greeting → SalaryCard → Jurang → Snap prompt → forecast band.
// Desktop: the salary on the left; the to-dos and the forecast on the right.
function Gaji() {
  const { t } = useI18n()
  const { user } = Route.useRouteContext()
  const home = useQuery(homeQuery)
  const bills = useQuery(billsQuery)
  const weeks = useQuery(weeksQuery)
  const s = home.data?.salary

  return (
    <>
      <ScreenHeader
        title={t('gaji.greeting', { name: user.displayName.split(' ')[0] })}
        action={
          <div className="flex items-center gap-1">
            <GuideButton screen="gaji" />
            {home.data && home.data.weeksLogged > 0 && <StreakChip streak={home.data.streak} />}
          </div>
        }
      />
      <GuideHint screen="gaji" />
      {home.isPending ? (
        <Skeleton className="h-72" />
      ) : home.isError ? (
        <ErrorState onRetry={() => home.refetch()} />
      ) : s ? (
        <div className="contents lg:grid lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-4">
          <div className="col">
            <SalaryCard salary={s} transfer={home.data.transfer} />
            {weeks.data && <EarningsChart weeks={weeks.data} salarySen={s.salarySen} className="lg:hidden" />}
            {home.data.weeksLogged > 0 && <StreakRow streak={home.data.streak} />}
            {s.jurang && <JurangCard essentialsSen={s.jurang.essentialsSen} salarySen={s.salarySen} gapSen={s.jurang.gapSen} />}
          </div>
          <div className="col">
            {home.data.needsSnap && (
              <Link to="/snap" className="pressable flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
                  <Camera size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t('gaji.snapDueTitle')}</span>
                  <span className="block text-sm text-muted">{t('gaji.snapDueBody')}</span>
                </span>
              </Link>
            )}
            {home.data.checkinDue && <CheckinCard weekStart={home.data.checkinDue} />}
            {!user.pocketReady && (
              <Link to="/pocket" className="pressable flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
                  <Landmark size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t('pocket.title')}</span>
                  <span className="block text-sm text-muted">{t('pocket.card')}</span>
                </span>
              </Link>
            )}
            {bills.data?.length === 0 && (
              <Link to="/bil" className="pressable flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
                  <CalendarPlus size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t('gaji.billsTitle')}</span>
                  <span className="block text-sm text-muted">{t('gaji.billsBody')}</span>
                </span>
              </Link>
            )}
            {weeks.data && <EarningsChart weeks={weeks.data} salarySen={s.salarySen} className="max-lg:hidden" />}
            <ForecastBand {...s.band} last={weeks.data?.[0]?.netSen} />
          </div>
        </div>
      ) : (
        <Columns>
        <div className="col">
          <section className="rounded-lg border-2 border-outline bg-surface">
            <EmptyState icon={Wallet} title={t('gaji.emptyTitle')} body={t('gaji.emptyBody')}>
              <Link to="/snap" data-tour="snap-start" className="btn btn-brand mt-2">
                <Camera size={20} aria-hidden />
                {t('gaji.snapCta')}
              </Link>
            </EmptyState>
          </section>
          <section aria-labelledby="how" data-tour="how" className="flex flex-col gap-3">
            <h2 id="how" className="px-1 text-sm font-semibold text-muted">
              {t('gaji.howTitle')}
            </h2>
            <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex items-start gap-3 p-4">
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
                    <Icon size={20} aria-hidden />
                    <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand text-[0.6875rem] font-bold text-on-brand">
                      {i + 1}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{t(title)}</p>
                    <p className="text-sm text-muted">{t(body)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="col">
          <SetupChecklist pocketReady={user.pocketReady} billsAdded={(bills.data?.length ?? 0) > 0} />
        </div>
        </Columns>
      )}
    </>
  )
}

// The last 12 weeks' earnings against today's salary: the bars jump around, the line stays put. Only with 2+ weeks.
function EarningsChart({ weeks, salarySen, className }: { weeks: Week[]; salarySen: number; className: string }) {
  const { t, lang } = useI18n()
  const last = weeks.slice(0, 12).reverse()
  if (last.length < 2) return null
  const rm = (v: number) => formatRM(v, { whole: true })
  const nets = last.map((w) => w.netSen)
  const salary = { color: 'var(--brand-text)', value: salarySen }
  return (
    <section className={`flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 ${className}`}>
      <div>
        <h2 className="font-semibold">{t('chart.earnedTitle')}</h2>
        <p className="text-sm text-muted">{t('chart.weeks', { n: last.length })}</p>
      </div>
      <Legend items={[{ color: 'var(--chart-bar)', label: t('chart.earned') }, { color: salary.color, label: `${t('chart.salary')} ${rm(salarySen)}`, line: true }]} />
      <BarChart
        cols={last.map((w) => ({ label: shortDate(w.weekStart, lang), parts: [{ color: 'var(--chart-bar)', value: w.netSen }] }))}
        line={salary}
        format={axisRM}
        summary={t('chart.earnedSummary', { n: last.length, min: rm(Math.min(...nets)), max: rm(Math.max(...nets)), salary: rm(salarySen) })}
        tips={last.map((w) => ({
          title: weekLabel(w.weekStart, lang),
          rows: [{ color: 'var(--chart-bar)', label: t('chart.earned'), value: formatRM(w.netSen) }, { color: salary.color, line: true, label: t('chart.salary'), value: rm(salarySen) }],
        }))}
      />
    </section>
  )
}

// Before the first salary: a short checklist of what's done and what's next
function SetupChecklist({ pocketReady, billsAdded }: { pocketReady: boolean; billsAdded: boolean }) {
  const { t } = useI18n()
  const items: { done: boolean; label: Key; to?: '/pocket' | '/bil' | '/snap' }[] = [
    { done: true, label: 'setup.profile' },
    { done: pocketReady, label: 'setup.pocket', to: '/pocket' },
    { done: billsAdded, label: 'setup.bills', to: '/bil' },
    { done: false, label: 'setup.snap', to: '/snap' },
  ]
  const doneCount = items.filter((i) => i.done).length
  return (
    <section aria-labelledby="setup" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="setup" className="font-semibold">{t('setup.title')}</h2>
        <span className="text-sm text-muted tabular-nums">{t('setup.progress', { done: doneCount, total: items.length })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-text" style={{ width: `${(doneCount / items.length) * 100}%` }} />
      </div>
      <ul className="flex flex-col">
        {items.map((it) => {
          const row = (
            <>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${it.done ? 'border-text bg-text text-bg' : 'border-line-strong'}`}>{it.done && <Check size={14} strokeWidth={3} aria-hidden />}</span>
              <span className={`min-w-0 flex-1 ${it.done ? 'text-muted line-through' : 'font-semibold'}`}>{t(it.label)}</span>
              {!it.done && it.to && <ChevronRight size={18} aria-hidden className="shrink-0 text-muted" />}
            </>
          )
          return (
            <li key={it.label}>
              {!it.done && it.to ? (
                <Link to={it.to} className="pressable -mx-2 flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-2 hover:bg-surface-2">{row}</Link>
              ) : (
                <span className="flex min-h-11 items-center gap-3">{row}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

