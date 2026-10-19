import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, createFileRoute, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { BottomNav } from '../components/BottomNav'
import { SideNav } from '../components/SideNav'
import { meQuery } from '../lib/api'
import { applyAppearance } from '../lib/appearance'
import { swipeTarget, tabDirection } from '../lib/tabs'

// Every signed-in screen lives under this pathless layout: it guards the session (FR-SHELL-4), adds the bottom nav (sidebar on desktop),
// and swipes between tabs.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) throw redirect({ to: '/login' })
    if (!user.onboarded) throw redirect({ to: '/onboarding' })
    return { user }
  },
  component: AppShell,
})

// Screens laid out in two columns on desktop get the wider content area; the rest stay a readable 640 px.
const WIDE = ['/', '/tabung', '/rekod']

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { data: user } = useQuery(meQuery)
  useEffect(() => {
    if (user) applyAppearance(user.theme, user.accent)
  }, [user])
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
      className="min-h-dvh overflow-x-clip lg:pl-60"
    >
      <div
        className={`mx-auto max-w-[480px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 ${WIDE.includes(pathname) ? 'lg:max-w-[1120px]' : 'lg:max-w-[640px]'}`}
      >
        {/* Keyed by path so each screen's sections animate in turn on arrival */}
        <div
          key={pathname}
          className="page-in flex flex-col gap-4"
          style={shown.dir ? ({ '--page-dx': `${shown.dir * 24}px`, '--page-dy': '0px' } as CSSProperties) : undefined}
        >
          <Outlet />
        </div>
      </div>
      <BottomNav />
      <SideNav />
    </div>
  )
}
