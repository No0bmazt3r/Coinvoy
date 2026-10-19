import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { GoogleIcon } from '../components/GoogleIcon'
import { LangToggle } from '../components/LangToggle'
import { Logo } from '../components/Logo'
import { useI18n, type Key } from '../i18n/t'
import { meQuery, post } from '../lib/api'
import { introSeen } from '../lib/intro'

// The API sends failed Google sign-ins back here as ?error=<reason> (docs/GOOGLE_AUTH_PORTABLE.md §2 rule 10).
const ERRORS: Record<string, Key> = {
  cancelled: 'login.error.cancelled',
  state: 'login.error.state',
  not_configured: 'login.error.notConfigured',
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === 'string' ? { error: search.error } : {},
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (user) throw redirect({ to: '/' })
    if (!introSeen()) throw redirect({ to: '/welcome' })
  },
  component: Login,
})

function Login() {
  const { t } = useI18n()
  const { error } = Route.useSearch()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const demo = useMutation({
    mutationFn: (persona: 'faiz' | 'lina') => post(persona === 'lina' ? '/api/auth/demo?persona=lina' : '/api/auth/demo'),
    onSuccess: async () => {
      // Refetch now: the route guard's ensureQueryData would otherwise reuse the cached "signed out" answer.
      await queryClient.fetchQuery({ ...meQuery, staleTime: 0 })
      await navigate({ to: '/' })
    },
  })

  const message = demo.isError ? t('login.error.demo') : error ? t(ERRORS[error] ?? 'login.error.failed') : ''

  return (
    <main className="page-in mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex justify-end pt-3">
        <LangToggle />
      </div>

      <section className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
        <Logo className="h-[120px] w-auto" />
        <h1 className="text-[2rem] leading-[2.375rem] font-extrabold tracking-tight">Coinvoy</h1>
        <p className="max-w-sm text-lg leading-[1.625rem] font-medium">{t('app.tagline')}</p>
        <p className="max-w-sm text-muted">{t('login.pitch')}</p>
      </section>

      <section className="flex flex-col gap-3">
        {/* A real navigation, not fetch: the API redirects to Google and back. */}
        <a href="/api/auth/google" className="btn btn-secondary">
          <GoogleIcon />
          {t('login.google')}
        </a>
        <div className="flex items-center gap-3 text-sm text-muted" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          {t('login.or')}
          <span className="h-px flex-1 bg-line" />
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => demo.mutate('faiz')} disabled={demo.isPending}>
          <Play size={18} aria-hidden />
          {t('login.demo')}
        </button>
        <button type="button" className="btn btn-ghost text-sm" onClick={() => demo.mutate('lina')} disabled={demo.isPending}>
          {t('login.demoLina')}
        </button>
        <p role="alert" className="min-h-5 text-center text-sm font-medium text-[var(--risky)]">
          {message}
        </p>
        <p className="text-center text-[0.8125rem] text-muted">{t('login.footnote')}</p>
      </section>
    </main>
  )
}
