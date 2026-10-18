import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Camera, Check, PencilLine } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { LangToggle } from '../components/LangToggle'
import { MoneyField } from '../components/MoneyField'
import { useI18n, type Key } from '../i18n/t'
import { api, errorText, meQuery, type Platform, type User } from '../lib/api'

export const PRIVACY_VERSION = '2026-10'
export const PLATFORMS: Platform[] = ['grab', 'foodpanda', 'shopeefood', 'lalamove', 'other']
export const CITIES = ['Kuala Lumpur', 'Selangor', 'Penang', 'Johor Bahru', 'Ipoh', 'Melaka', 'Seremban', 'Kota Kinabalu', 'Kuching']
const DAYS: Key[] = ['day.0', 'day.1', 'day.2', 'day.3', 'day.4', 'day.5', 'day.6']

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) throw redirect({ to: '/login' })
    if (user.onboarded) throw redirect({ to: '/' })
    return { user }
  },
  component: Onboarding,
})

// One question per screen, first salary within 2 minutes (J1). Bills come after the first salary, from home.
function Onboarding() {
  const { t, lang } = useI18n()
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [privacy, setPrivacy] = useState(false)
  const [ai, setAi] = useState(true)
  const [platforms, setPlatforms] = useState<Platform[]>(user.platforms)
  const [city, setCity] = useState(user.city ?? '')
  const [hours, setHours] = useState(user.defaultHours ?? 45)
  const [payday, setPayday] = useState<number>(user.paydayWeekday ?? 0)
  const [essentials, setEssentials] = useState<number | null>(user.essentialsWeekSen)

  const save = useMutation({
    mutationFn: async (s: number) => {
      if (s === 0) {
        await api('/api/consents', { body: { kind: 'privacy', version: PRIVACY_VERSION, granted: true } })
        await api('/api/consents', { body: { kind: 'llm_processing', version: PRIVACY_VERSION, granted: ai } })
      } else {
        const body =
          s === 1 ? { platforms, city: city || null } : s === 2 ? { defaultHours: hours, paydayWeekday: payday } : { essentialsWeekSen: essentials, lang, onboarded: true }
        const { user: fresh } = await api<{ user: User }>('/api/me', { method: 'PATCH', body })
        queryClient.setQueryData(meQuery.queryKey, fresh)
      }
    },
    onSuccess: (_d, s) => setStep(s + 1),
  })

  const canNext = [privacy, platforms.length > 0, true, essentials !== null && essentials > 0][step]
  const screens: { title: Key; body?: Key; content: ReactNode }[] = [
    {
      title: 'onb.privacyTitle',
      body: 'onb.privacyBody',
      content: (
        <>
          <ul className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
            {(['onb.privacy1', 'onb.privacy2', 'onb.privacy3', 'onb.privacy4'] as Key[]).map((k) => (
              <li key={k} className="flex gap-2">
                <Check size={18} className="mt-0.5 shrink-0 text-brand-text" aria-hidden />
                {t(k)}
              </li>
            ))}
          </ul>
          <Link to="/privacy" className="btn-ghost self-start text-sm font-semibold">
            {t('onb.privacyFull')}
          </Link>
          <Check2 checked={privacy} onChange={setPrivacy} label={t('onb.privacyAgree')} />
          <Check2 checked={ai} onChange={setAi} label={t('onb.aiAgree')} hint={t('onb.aiHint')} />
        </>
      ),
    },
    {
      title: 'onb.platformsTitle',
      body: 'onb.platformsBody',
      content: (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('onb.platformsTitle')}>
            {PLATFORMS.map((p) => (
              <Chip key={p} on={platforms.includes(p)} onClick={() => setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))}>
                {t(`platform.${p}` as Key)}
              </Chip>
            ))}
          </div>
          <label className="mt-2 flex flex-col gap-1 text-sm font-semibold">
            {t('onb.city')}
            <select value={city} onChange={(e) => setCity(e.target.value)} className="h-12 rounded-[var(--radius-sm)] border border-line-strong bg-surface-2 px-3 text-base font-normal">
              <option value="">{t('onb.cityOther')}</option>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </>
      ),
    },
    {
      title: 'onb.hoursTitle',
      body: 'onb.hoursBody',
      content: (
        <>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            <span className="flex justify-between">
              {t('onb.hoursLabel')}
              <span className="text-2xl font-extrabold tabular-nums">{t('onb.hoursValue', { n: hours })}</span>
            </span>
            <input type="range" min={0} max={84} step={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="accent-[var(--brand-text)]" data-no-swipe />
          </label>
          {hours > 60 && <p className="rounded-[var(--radius-sm)] bg-[var(--careful-bg)] p-3 text-sm text-[var(--careful)]">{t('onb.fatigue')}</p>}
          <p className="mt-2 text-sm font-semibold">{t('onb.payday')}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('onb.payday')}>
            {DAYS.map((d, i) => (
              <Chip key={d} on={payday === i} onClick={() => setPayday(i)}>
                {t(d)}
              </Chip>
            ))}
          </div>
        </>
      ),
    },
    {
      title: 'onb.essentialsTitle',
      body: 'onb.essentialsBody',
      content: <MoneyField label={t('onb.essentialsLabel')} valueSen={essentials} onChange={setEssentials} hint={t('onb.essentialsHint')} required />,
    },
    {
      title: 'onb.firstTitle',
      body: 'onb.firstBody',
      content: (
        <div className="flex flex-col gap-3">
          <Link to="/snap" search={{ mode: 'history' }} className="btn btn-primary">
            <Camera size={20} aria-hidden />
            {t('onb.firstSnap')}
          </Link>
          <Link to="/snap" search={{ mode: 'manual' }} className="btn btn-secondary">
            <PencilLine size={20} aria-hidden />
            {t('onb.firstManual')}
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => navigate({ to: '/' })}>
            {t('onb.firstLater')}
          </button>
        </div>
      ),
    },
  ]
  const screen = screens[step]
  const last = step === screens.length - 1

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="flex min-h-11 items-center gap-2">
        {step > 0 && !last && (
          <button type="button" onClick={() => setStep(step - 1)} aria-label={t('common.back')} className="pressable -ml-2 grid size-11 place-items-center rounded-full hover:bg-surface-2">
            <ArrowLeft size={24} aria-hidden />
          </button>
        )}
        <div className="flex flex-1 justify-center gap-1.5" aria-label={t('onb.progress', { n: step + 1, total: screens.length })} role="img">
          {screens.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all duration-200 ${i === step ? 'w-6 bg-brand-text' : i < step ? 'w-2 bg-brand-text/60' : 'w-2 bg-line'}`} />
          ))}
        </div>
        <LangToggle />
      </div>
      <div key={step} className="page-in flex flex-1 flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t(screen.title)}</h1>
        {screen.body && <p className="text-muted">{t(screen.body)}</p>}
        {screen.content}
      </div>
      {save.isError && (
        <p role="alert" className="text-sm font-semibold text-[var(--risky)]">
          {errorText(save.error, lang, t('common.tryAgain'))}
        </p>
      )}
      {!last && (
        <button type="button" className="btn btn-primary" disabled={!canNext || save.isPending} onClick={() => save.mutate(step)}>
          {t('intro.next')}
        </button>
      )}
    </main>
  )
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`pressable min-h-11 rounded-full border px-4 text-sm font-semibold ${on ? 'border-transparent bg-brand text-on-brand' : 'border-line-strong bg-surface text-text'}`}
    >
      {children}
    </button>
  )
}

function Check2({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--brand-text)]" />
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
    </label>
  )
}
