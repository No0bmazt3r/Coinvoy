import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
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
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <Outlet />
      <BottomNav />
    </div>
  )
}
