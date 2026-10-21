import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ErrorState } from '../../components/ErrorState'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Skeleton } from '../../components/Skeleton'
import { useI18n } from '../../i18n/t'
import { api } from '../../lib/api'

export const Route = createFileRoute('/_app/admin')({ component: Admin })

type Usage = {
  riders: { riders: number; onboarded: number; active7d: number; demos: number; pushReminders: number }
  retention: { cohort: number; week2: number | null; week3: number | null; week4: number | null }
  guides: Record<string, { started: number; completed: number; skipped: number }>
  llm: {
    days: number
    rows: { route: string; model: string; calls: number; riders: number; inputTokens: number; outputTokens: number; myr: number | null }[]
    riders: number
    myrPerRider: number | null
    pricesChecked: string | null
  }
}

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`)

// The team's usage view (ADMIN_EMAILS only): counts, pilot retention and AI cost. No rider's data.
function Admin() {
  const { t } = useI18n()
  const q = useQuery({ queryKey: ['admin'], queryFn: () => api<Usage>('/api/admin/usage') })
  if (q.isPending) return <Skeleton className="h-80" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const { riders, retention, guides, llm } = q.data
  const stats: [string, number | string][] = [
    [t('admin.riders'), riders.riders],
    [t('admin.onboarded'), riders.onboarded],
    [t('admin.active'), riders.active7d],
    [t('admin.push'), riders.pushReminders],
    [t('admin.demos'), riders.demos],
    [t('admin.retention'), `${pct(retention.week2)} / ${pct(retention.week3)} / ${pct(retention.week4)}`],
  ]
  return (
    <>
      <ScreenHeader title={t('admin.title')} back />
      <dl className="grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">{t('admin.cohort', { n: retention.cohort })}</p>
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold">{t('admin.guides')}</h2>
        {Object.keys(guides).length === 0 ? (
          <p className="text-sm text-muted">{t('admin.none')}</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-muted">
              <tr><th className="py-1 pr-2" /><th className="text-right">{t('admin.guidesHead')}</th></tr>
            </thead>
            <tbody>
              {Object.entries(guides).map(([screen, g]) => (
                <tr key={screen} className="border-t border-line">
                  <td className="py-1 pr-2 capitalize">{screen}</td>
                  <td className="text-right">{g.started} / {g.completed} / {g.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-semibold">{t('admin.llm', { n: llm.days })}</h2>
        {llm.rows.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-muted">
                <tr><th className="py-1 pr-2">Route</th><th className="pr-2">Model</th><th className="pr-2 text-right">{t('admin.calls')}</th><th className="pr-2 text-right">Tokens</th><th className="text-right">RM</th></tr>
              </thead>
              <tbody>
                {llm.rows.map((r) => (
                  <tr key={r.route + r.model} className="border-t border-line">
                    <td className="py-1 pr-2">{r.route}</td>
                    <td className="max-w-[8rem] truncate pr-2">{r.model}</td>
                    <td className="pr-2 text-right">{r.calls}</td>
                    <td className="pr-2 text-right">{(r.inputTokens + r.outputTokens).toLocaleString()}</td>
                    <td className="text-right">{r.myr === null ? '–' : r.myr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm">
          {llm.myrPerRider === null ? t('admin.noPrices') : t('admin.perRider', { rm: llm.myrPerRider.toFixed(2), date: llm.pricesChecked ?? '' })}
        </p>
      </section>
    </>
  )
}
