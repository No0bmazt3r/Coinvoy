import { Logo } from './Logo'
import { useI18n } from '../i18n/t'

// Shown while the session check runs. Always on ink, matching the manifest's background_color.
export function Splash() {
  const { t } = useI18n()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-4 text-center text-on-ink">
      <div className="splash-in flex flex-col items-center gap-4">
        <Logo className="h-[132px] w-auto" />
        <p className="text-[2rem] leading-[2.375rem] font-extrabold tracking-tight">Coinvoy</p>
        <p className="max-w-xs text-on-ink-muted">{t('app.tagline')}</p>
      </div>
      <div role="status" className="mt-10 flex flex-col items-center gap-2">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/15">
          <div className="splash-bar h-full w-2/5 rounded-full bg-brand" />
        </div>
        <span className="sr-only">{t('splash.loading')}</span>
      </div>
    </main>
  )
}
