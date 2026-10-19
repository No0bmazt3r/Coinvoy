import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Award, Check, Flame, Lock, Share2, Snowflake } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Sheet } from '../../components/Sheet'
import { Skeleton } from '../../components/Skeleton'
import { useI18n, type Key } from '../../i18n/t'
import { type Accent, api, errorText, meQuery, streakQuery, type User } from '../../lib/api'
import { applyAppearance } from '../../lib/appearance'
import { thisWeekStart } from '../../lib/dates'
import { shareImage, streakCard } from '../../lib/shareCard'

export const Route = createFileRoute('/_app/pencapaian')({ component: Achievements })

const ACCENTS: { id: Accent; color: string }[] = [
  { id: 'lime', color: '#B5FC04' },
  { id: 'aqua', color: '#5EEAD4' },
  { id: 'amber', color: '#FCD34D' },
  { id: 'pink', color: '#F9A8D4' },
  { id: 'sky', color: '#7DD3FC' },
]
const BADGES = ['minggu_pertama', 'pindah_pertama', 'konsisten_4', 'konsisten_12', 'penampan_penuh', 'cuti_pertama', 'isaraan_dituntut']

// Streaks are rewards, never gates (FR-STRK-1..7): a level title, accent colours and badges for real progress.
// Never hours or trips, and never a leaderboard.
function Achievements() {
  const { t, lang } = useI18n()
  const q = useQuery(streakQuery)
  const { data: user } = useQuery(meQuery)
  const [shareOpen, setShareOpen] = useState(false)
  const queryClient = useQueryClient()
  const accent = useMutation({
    mutationFn: (a: Accent) => api<{ user: User }>('/api/me', { method: 'PATCH', body: { accent: a } }),
    onSuccess: ({ user: u }) => {
      queryClient.setQueryData(meQuery.queryKey, u)
      applyAppearance(u.theme, u.accent)
    },
  })
  const freeze = useMutation({
    mutationFn: () => api('/api/streak/freeze', { body: { weekStart: thisWeekStart() } }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  if (q.isPending) return <Skeleton className="h-80" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const s = q.data
  const earned = new Set((s.badges ?? []).map((b) => b.kind))
  return (
    <>
      <ScreenHeader title={t('ach.title')} back />
      <section className="flex flex-col items-center gap-2 rounded-lg border-2 border-outline bg-surface p-5 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand text-on-brand">
          <Flame size={32} aria-hidden />
        </span>
        <p className="text-[2rem] leading-[2.375rem] font-extrabold tabular-nums">{t('streak.weeks', { n: s.weeks })}</p>
        <p className="font-semibold">{t(`level.${s.level}` as Key)}</p>
        {s.nextLevelAt !== null && <p className="text-sm text-muted">{t('ach.next', { n: s.nextLevelAt - s.weeks })}</p>}
        {s.atRisk && <p className="rounded-[var(--radius-sm)] bg-[var(--careful-bg)] p-2 text-sm text-[var(--careful)]">{t('ach.atRisk')}</p>}
        <p className="text-sm text-muted">{t('ach.counts', { transfers: s.transfersConfirmed, kept: s.gajiKept })}</p>
        {s.weeks > 0 && (
          <button type="button" className="btn btn-secondary mt-2" onClick={() => setShareOpen(true)}>
            <Share2 size={18} aria-hidden /> {t('ach.share')}
          </button>
        )}
      </section>
      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title={t('ach.share')}>
        {shareOpen && <ShareCard weeks={s.weeks} level={t(`level.${s.level}` as Key)} accent={ACCENTS.find((a) => a.id === user?.accent)?.color ?? ACCENTS[0]!.color} />}
      </Sheet>
      <section aria-labelledby="accents" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 id="accents" className="font-semibold">
          {t('ach.accents')}
        </h2>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a, i) => {
            const open = s.accents.includes(a.id)
            const on = user?.accent === a.id
            return (
              <button
                key={a.id}
                type="button"
                disabled={!open || accent.isPending}
                onClick={() => accent.mutate(a.id)}
                aria-pressed={on}
                aria-label={open ? t(`accent.${a.id}` as Key) : t('ach.lockedAt', { name: t(`accent.${a.id}` as Key), level: t(`level.${i}` as Key) })}
                className={`pressable grid size-12 place-items-center rounded-full border-2 ${on ? 'border-text' : 'border-transparent'} disabled:opacity-40`}
                style={{ background: a.color }}
              >
                {on ? <Check size={20} className="text-[#1D1E1D]" aria-hidden /> : !open && <Lock size={18} className="text-[#1D1E1D]" aria-hidden />}
              </button>
            )
          })}
        </div>
        {accent.isError && <p className="text-sm text-[var(--risky)]">{errorText(accent.error, lang, t('common.tryAgain'))}</p>}
      </section>
      <section aria-labelledby="badges" className="flex flex-col gap-3">
        <h2 id="badges" className="px-1 text-sm font-semibold text-muted">
          {t('ach.badges')}
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {BADGES.map((b) => (
            <li key={b} className={`flex flex-col gap-1 rounded-lg border p-3 ${earned.has(b) ? 'border-outline bg-surface' : 'border-dashed border-line text-muted'}`}>
              <Award size={22} aria-hidden className={earned.has(b) ? 'text-brand-text' : ''} />
              <span className="text-sm font-semibold">{t(`badge.${b}` as Key)}</span>
              <span className="text-[0.8125rem]">{earned.has(b) ? t('ach.earned') : t(`badge.${b}.how` as Key)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Snowflake size={18} aria-hidden /> {t('ach.freezeTitle')}
        </h2>
        <p className="text-sm text-muted">{t('ach.freezeBody', { n: s.freezesLeft })}</p>
        <button type="button" className="btn btn-secondary" disabled={s.freezesLeft < 1 || s.frozenThisWeek || freeze.isPending} onClick={() => freeze.mutate()}>
          {t('ach.freeze')}
        </button>
      </section>
      <p className="text-[0.8125rem] text-muted">{t('ach.noRanking')}</p>
    </>
  )
}

function ShareCard({ weeks, level, accent }: { weeks: number; level: string; accent: string }) {
  const { t } = useI18n()
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [done, setDone] = useState<'shared' | 'downloaded' | null>(null)
  const weeksLabel = t('share.weeksInRow')
  const tagline = t('app.tagline')
  useEffect(() => {
    let live = true
    let made: string | null = null
    streakCard({ weeks, weeksLabel, level, tagline, accent }).then((b) => {
      if (!live) return
      made = URL.createObjectURL(b)
      setBlob(b)
      setUrl(made)
    })
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [weeks, weeksLabel, level, tagline, accent])
  return (
    <div className="flex flex-col gap-3">
      {url ? <img src={url} alt={t('share.alt', { n: weeks })} className="aspect-square w-full rounded-lg" /> : <Skeleton className="aspect-square w-full" />}
      <p className="text-sm text-muted">{t('ach.shareHint')}</p>
      <button type="button" className="btn btn-primary" disabled={!blob} onClick={async () => blob && setDone(await shareImage(blob, t('share.message')))}>
        <Share2 size={18} aria-hidden /> {t('ach.share')}
      </button>
      {done === 'downloaded' && <p className="text-sm text-muted">{t('share.downloaded')}</p>}
    </div>
  )
}
