import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { LangToggle } from '../../components/LangToggle'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useI18n } from '../../i18n/t'
import { meQuery, post } from '../../lib/api'

export const Route = createFileRoute('/_app/settings')({ component: Settings })

function Settings() {
  const { t } = useI18n()
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: () => post('/api/auth/logout'),
    onSettled: async () => {
      queryClient.setQueryData(meQuery.queryKey, null)
      await navigate({ to: '/login' })
    },
  })

  return (
    <>
      <ScreenHeader title={t('settings.title')} back />
      <div className="flex flex-col gap-4">
        <section className="flex items-center gap-3 rounded-md border border-line bg-surface p-4">
          {user.avatarUrl && (
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-11 rounded-full" />
          )}
          <div className="min-w-0">
            <p className="font-semibold">{user.displayName}</p>
            <p className="truncate text-sm text-muted">{user.isDemo ? t('settings.demoAccount') : user.email}</p>
          </div>
        </section>
        <section className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4">
          <span className="font-semibold">{t('lang.label')}</span>
          <LangToggle />
        </section>
        <button type="button" className="btn btn-secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut size={20} aria-hidden />
          {t('settings.logout')}
        </button>
      </div>
    </>
  )
}
