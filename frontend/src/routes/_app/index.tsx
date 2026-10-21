import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarPlus, Camera, Landmark, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'
import { CheckinCard } from '../../components/CheckinCard'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { ForecastBand } from '../../components/ForecastBand'
import { JurangCard } from '../../components/JurangCard'
import { SalaryCard } from '../../components/SalaryCard'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Skeleton } from '../../components/Skeleton'
import { StreakChip } from '../../components/StreakChip'
import { StreakRow } from '../../components/StreakRow'
import { useI18n, type Key } from '../../i18n/t'
import { billsQuery, homeQuery, weeksQuery } from '../../lib/api'

export const Route = createFileRoute('/_app/')({ component: Gaji })

const STEPS: { icon: LucideIcon; title: Key; body: Key }[] = [
  { icon: Camera, title: 'gaji.step1Title', body: 'gaji.step1Body' },
  { icon: Wallet, title: 'gaji.step2Title', body: 'gaji.step2Body' },
  { icon: PiggyBank, title: 'gaji.step3Title', body: 'gaji.step3Body' },
]

// Home = the salary (FR-GAJI-1): greeting → SalaryCard → Jurang → Snap prompt → forecast band (design-system §7).
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
        action={home.data && home.data.weeksLogged > 0 ? <StreakChip streak={home.data.streak} /> : undefined}
      />
      {home.isPending ? (
        <Skeleton className="h-72" />
      ) : home.isError ? (
        <ErrorState onRetry={() => home.refetch()} />
      ) : s ? (
        <div className="contents lg:grid lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-4">
          <div className="col">
            <SalaryCard salary={s} transfer={home.data.transfer} />
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
            <ForecastBand {...s.band} last={weeks.data?.[0]?.netSen} />
          </div>
        </div>
      ) : (
        <div className="col lg:mx-auto lg:w-full lg:max-w-[640px]">
          <section className="rounded-lg border-2 border-outline bg-surface">
            <EmptyState icon={Wallet} title={t('gaji.emptyTitle')} body={t('gaji.emptyBody')}>
              <Link to="/snap" className="btn btn-brand mt-2">
                <Camera size={20} aria-hidden />
                {t('gaji.snapCta')}
              </Link>
            </EmptyState>
          </section>
          <section aria-labelledby="how" className="flex flex-col gap-3">
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
      )}
    </>
  )
}
