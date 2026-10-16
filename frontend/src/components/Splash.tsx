import { Logo } from './Logo'
import { useI18n } from '../i18n/t'

// Shown while the session check runs. Always on ink, matching the manifest's background_color.
export function Splash() {
  const { t } = useI18n()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-ink px-4 text-center text-on-ink">
      <div className="relative grid place-items-center">
        <span aria-hidden className="splash-glow absolute size-64 rounded-full bg-brand blur-3xl" />
        <div className="splash-logo relative">
          <Logo className="h-[132px] w-auto" />
          <span aria-hidden className="splash-shine absolute inset-0" />
        </div>
      </div>
      <p className="rise text-[2rem] leading-[2.375rem] font-extrabold tracking-tight [animation-delay:350ms]">Coinvoy</p>
      <p className="rise max-w-xs text-on-ink-muted [animation-delay:480ms]">{t('app.tagline')}</p>
      <div role="status" className="rise mt-10 flex flex-col items-center gap-2 [animation-delay:650ms]">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/15">
          <div className="splash-bar h-full w-2/5 rounded-full bg-brand" />
        </div>
        <span className="sr-only">{t('splash.loading')}</span>
      </div>
    </main>
  )
}
