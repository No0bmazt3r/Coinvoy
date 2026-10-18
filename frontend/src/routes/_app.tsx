import { useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { Outlet, createFileRoute, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { BottomNav } from '../components/BottomNav'
import { meQuery } from '../lib/api'
import { swipeTarget, tabDirection } from '../lib/tabs'

// Every signed-in screen lives under this pathless layout: it guards the session (FR-SHELL-4), adds the bottom nav, and swipes between tabs.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) throw redirect({ to: '/login' })
    if (!user.onboarded) throw redirect({ to: '/onboarding' })
    return { user }
  },
  component: AppShell,
})

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const start = useRef<{ x: number; y: number } | null>(null)

  // Tab changes (tap or swipe) slide in from the side they sit on; other screens fade up.
  const [shown, setShown] = useState({ path: pathname, dir: 0 })
  if (shown.path !== pathname) setShown({ path: pathname, dir: tabDirection(shown.path, pathname) })

  const onTouchStart = (e: TouchEvent) => {
    // Inputs and anything marked data-no-swipe (sliders, horizontal carousels) keep their own gestures
    const ignore = e.touches.length > 1 || (e.target as Element).closest('input, textarea, select, [data-no-swipe]')
    start.current = ignore ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: TouchEvent) => {
    if (!start.current) return
    const t = e.changedTouches[0]
    const to = swipeTarget(pathname, start.current.x, t.clientX - start.current.x, t.clientY - start.current.y, window.innerWidth)
    start.current = null
    if (to) navigate({ to })
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      // clip, not hidden: the slide-in from the right must not widen the page (the fixed nav jumped), and sticky headers keep working
      className="mx-auto min-h-dvh max-w-[480px] overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]"
    >
      {/* Keyed by path so each screen's sections animate in turn on arrival */}
      <div
        key={pathname}
        className="page-in flex flex-col gap-4"
        style={shown.dir ? ({ '--page-dx': `${shown.dir * 24}px`, '--page-dy': '0px' } as CSSProperties) : undefined}
      >
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
