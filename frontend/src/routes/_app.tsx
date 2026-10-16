import { Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { BottomNav } from '../components/BottomNav'
import { meQuery } from '../lib/api'

// Every signed-in screen lives under this pathless layout: it guards the session (FR-SHELL-4) and adds the bottom nav.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: AppShell,
})

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Keyed by path so each screen's sections fade up in turn on arrival */}
      <div key={pathname} className="page-in flex flex-col gap-4">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
