import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Camera, Check, Loader2, PencilLine } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { MoneyField } from '../components/MoneyField'
import { PlatformPicker } from '../components/PlatformPicker'
import { Select } from '../components/Select'
import { useI18n, type Key, type Lang } from '../i18n/t'
import { api, errorText, meQuery, type Platform, type User } from '../lib/api'
import { applyAppearance } from '../lib/appearance'

export const PRIVACY_VERSION = '2026-10'
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
  const { t, lang, setLang } = useI18n()
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
  const [theme, setTheme] = useState<User['theme']>(user.theme)
  const [failed, setFailed] = useState<unknown>(null)
  const saving = useIsMutating({ mutationKey: ['onboarding'] }) > 0

  // Optimistic: the next question shows at once and each answer saves in the background. A failed save brings the
  // rider back to that question with the error; the last screen waits only for "onboarded" to land.
  const save = useMutation({
    mutationKey: ['onboarding'],
    mutationFn: async (s: number) => {
      if (s === 0) {
        await api('/api/consents', { body: { kind: 'privacy', version: PRIVACY_VERSION, granted: true } })
        await api('/api/consents', { body: { kind: 'llm_processing', version: PRIVACY_VERSION, granted: ai } })
      } else {
        const body =
          s === 1 ? { platforms, city: city || null } : s === 2 ? { defaultHours: hours, paydayWeekday: payday } : s === 3 ? { essentialsWeekSen: essentials } : { lang, theme, onboarded: true }
        const { user: fresh } = await api<{ user: User }>('/api/me', { method: 'PATCH', body })
        if (s === 4) queryClient.setQueryData(meQuery.queryKey, fresh) // only the last answer: earlier replies can land after it
      }
    },
    onMutate: (s) => {
      setFailed(null)
      setStep(s + 1)
    },
    onError: (err, s) => {
      setFailed(err)
      setStep(s)
    },
  })
  const pickTheme = (th: User['theme']) => {
    setTheme(th)
    applyAppearance(th, user.accent) // preview it now; it's saved with this step
  }

  const canNext = [privacy, platforms.length > 0, true, essentials !== null && essentials > 0, true][step]
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
          <PlatformPicker value={platforms} onChange={setPlatforms} />
          <div className="mt-2">
            <Select label={t('onb.city')} value={city} onChange={setCity} options={cityOptions(t('onb.cityOther'))} />
          </div>
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
      title: 'onb.prefsTitle',
      body: 'onb.prefsBody',
      content: (
        <>
          <p className="text-sm font-semibold">{t('lang.label')}</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('lang.label')}>
            {([['ms', 'Bahasa Melayu'], ['en', 'English']] as [Lang, string][]).map(([l, name]) => (
              <Chip key={l} on={lang === l} onClick={() => setLang(l)}>{name}</Chip>
            ))}
          </div>
          <p className="mt-2 text-sm font-semibold">{t('settings.theme')}</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('settings.theme')}>
            {(['system', 'light', 'dark'] as User['theme'][]).map((th) => (
              <Chip key={th} on={theme === th} onClick={() => pickTheme(th)}>{t(`theme.${th}` as Key)}</Chip>
            ))}
          </div>
        </>
      ),
    },
    {
      title: 'onb.firstTitle',
      body: 'onb.firstBody',
      content: (
        <div aria-busy={saving} className={`flex flex-col gap-3 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
          {saving && <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 size={16} className="spin" aria-hidden /> {t('onb.saving')}</p>}
          <Link to="/snap" search={{ mode: 'history' }} className="btn btn-brand">
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
    // Desktop: an ink panel listing every step beside the question, which sits centred on the right
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[minmax(340px,2fr)_3fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-12 bg-ink px-12 py-10 text-on-ink lg:flex">
        <span className="flex items-center gap-2">
          <Logo className="h-9 w-auto" />
          <span className="text-xl font-extrabold tracking-tight">Coinvoy</span>
        </span>
        <ol className="flex flex-col gap-1" aria-label={t('onb.progress', { n: step + 1, total: screens.length })}>
          {screens.map((sc, i) => (
            <li key={sc.title} aria-current={i === step ? 'step' : undefined} className={`flex items-center gap-4 rounded-[var(--radius-md)] px-3 py-3 transition-colors duration-200 ${i === step ? 'bg-white/5 text-on-ink' : 'text-on-ink-muted'}`}>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors duration-200 ${i < step ? 'bg-brand text-on-brand' : i === step ? 'border-2 border-brand text-brand' : 'border border-white/20'}`}>
                {i < step ? <Check size={16} strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className="font-semibold">{t(sc.title)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-auto max-w-xs text-lg font-medium text-on-ink-muted">{t('app.tagline')}</p>
      </aside>
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:w-full lg:max-w-[clamp(32rem,42vw,52rem)] lg:justify-center lg:px-8 lg:py-16">
        {/* Progress centred on the screen, whether or not the back button is there */}
        <div className="relative flex min-h-11 items-center">
          {step > 0 && !last && (
            <button type="button" onClick={() => setStep(step - 1)} aria-label={t('common.back')} className="pressable relative z-10 -ml-2 grid size-11 place-items-center rounded-full hover:bg-surface-2">
              <ArrowLeft size={24} aria-hidden />
            </button>
          )}
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 lg:invisible" aria-label={t('onb.progress', { n: step + 1, total: screens.length })} role="img">
            {screens.map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all duration-200 ${i === step ? 'w-6 bg-brand-text' : i < step ? 'w-2 bg-brand-text/60' : 'w-2 bg-line'}`} />
            ))}
          </div>
        </div>
        <div key={step} className="page-in flex flex-1 flex-col gap-4 lg:flex-none">
          <h1 className="text-2xl font-bold tracking-tight lg:text-[clamp(2.25rem,3vw,3.5rem)] lg:leading-tight">{t(screen.title)}</h1>
          {screen.body && <p className="text-muted">{t(screen.body)}</p>}
          {screen.content}
        </div>
        {failed !== null && (
          <p role="alert" className="text-sm font-semibold text-[var(--risky)]">
            {errorText(failed, lang, t('common.tryAgain'))}
          </p>
        )}
        {!last && (
          <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => save.mutate(step)}>
            {t('intro.next')}
          </button>
        )}
      </main>
    </div>
  )
}

export const cityOptions = (other: string) => [...CITIES.map((c) => ({ value: c, label: c })), { value: '', label: other }]

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`pressable min-h-11 rounded-full border px-4 text-sm font-semibold ${on ? 'border-text bg-text text-bg' : 'border-line-strong bg-surface text-text'}`}
    >
      {children}
    </button>
  )
}

function Check2({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--text)]" />
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
    </label>
  )
}
