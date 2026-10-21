import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useI18n, type Key } from '../../i18n/t'
import { api, errorText, meQuery, type User } from '../../lib/api'

export const Route = createFileRoute('/_app/pocket')({ component: PocketGuide })

const STEPS = [1, 2, 3, 4, 5] as const

// The pocket setup guide: Coinvoy never holds money, so the rider keeps the Penampan in their own bank.
function PocketGuide() {
  const { t, lang } = useI18n()
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const done = useMutation({
    mutationFn: () => api<{ user: User }>('/api/me', { method: 'PATCH', body: { pocketReady: true } }),
    onSuccess: async ({ user: u }) => {
      queryClient.setQueryData(meQuery.queryKey, u)
      await navigate({ to: '/' })
    },
  })
  return (
    <>
      <ScreenHeader title={t('pocket.title')} back />
      <p className="text-muted">{t('pocket.intro')}</p>
      <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface lg:grid lg:grid-cols-5 lg:divide-x lg:divide-y-0">
        {STEPS.map((n) => (
          <li key={n} className="flex items-start gap-3 p-4 lg:flex-col">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-bold text-on-brand">{n}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t(`pocket.step${n}.title` as Key)}</span>
              <span className="block text-sm text-muted">{t(`pocket.step${n}.body` as Key)}</span>
            </span>
          </li>
        ))}
      </ol>
      {user.pocketReady ? (
        <p className="flex items-center justify-center gap-2 font-semibold text-brand-text">
          <Check size={20} aria-hidden /> {t('pocket.ready')}
        </p>
      ) : (
        <button type="button" className="btn btn-primary lg:w-80 lg:self-end" onClick={() => done.mutate()} disabled={done.isPending}>
          <Check size={20} aria-hidden /> {t('pocket.done')}
        </button>
      )}
      {done.isError && <p role="alert" className="text-sm text-[var(--risky)]">{errorText(done.error, lang, t('common.tryAgain'))}</p>}
    </>
  )
}
