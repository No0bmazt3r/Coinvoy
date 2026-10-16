import { useI18n, type Lang } from '../i18n/t'

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'ms', label: 'BM' },
  { value: 'en', label: 'EN' },
]

export function LangToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div role="group" aria-label={t('lang.label')} className="inline-flex rounded-full border border-line-strong bg-surface p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={lang === o.value}
          onClick={() => setLang(o.value)}
          className={`min-h-11 min-w-12 rounded-full px-3 text-sm font-semibold ${
            lang === o.value ? 'bg-text text-bg' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
