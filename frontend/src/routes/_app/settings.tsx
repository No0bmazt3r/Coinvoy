import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, FileText, Languages, LogOut } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { LangToggle } from '../../components/LangToggle'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useI18n } from '../../i18n/t'
import { meQuery, post } from '../../lib/api'

export const Route = createFileRoute('/_app/settings')({ component: Settings })

const ROW = 'flex min-h-14 items-center gap-3 px-4 py-3'

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
      <ScreenHeader title={t('settings.title')} />
      <section className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-4 py-6 text-center">
        <Avatar user={user} className="size-20 text-3xl ring-4 ring-brand" />
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight">{user.displayName}</p>
          <p className="truncate text-sm text-muted">{user.isDemo ? t('settings.demoAccount') : user.email}</p>
        </div>
      </section>
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        <Link to="/rekod" className={`${ROW} pressable hover:bg-surface-2`}>
          <FileText size={22} aria-hidden />
          <span className="flex-1 font-semibold">{t('rekod.title')}</span>
          <ChevronRight size={20} className="text-muted" aria-hidden />
        </Link>
        <div className={ROW}>
          <Languages size={22} aria-hidden />
          <span className="flex-1 font-semibold">{t('lang.label')}</span>
          <LangToggle />
        </div>
      </div>
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className={`${ROW} pressable justify-center rounded-lg border border-line bg-surface font-semibold text-[var(--risky)] hover:bg-surface-2 disabled:opacity-50`}
      >
        <LogOut size={20} aria-hidden />
        {t('settings.logout')}
      </button>
    </>
  )
}
