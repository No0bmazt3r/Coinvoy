import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, createFileRoute, redirect, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { BottomNav } from '../components/BottomNav'
import { SideNav } from '../components/SideNav'
import { meQuery } from '../lib/api'
import { applyAppearance } from '../lib/appearance'
import { TABS, dragOffset, swipeTarget, tabDirection } from '../lib/tabs'

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

// Desktop: every screen sits in one centred container. Wide (1120 px) for screens with two columns (Gaji with a
// salary, Rekod, and the tools with an input beside its result); narrow (720 px) for the rest. A screen can ask for
// narrow at times by marking an element data-narrow (Gaji before its first salary) — see .page-wide in index.css.
const WIDE = ['/', '/rekod', '/layak', '/pemberi', '/semak', '/snap']

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { data: user } = useQuery(meQuery)
  useEffect(() => {
    if (user) applyAppearance(user.theme, user.accent)
  }, [user])
  // Once the first screen is up, warm the other tabs (their code and data) while the phone is idle, so moving forward
  // is as quick as moving back.
  const router = useRouter()
  useEffect(() => {
    const warm = () => TABS.forEach((to) => void router.preloadRoute({ to }).catch(() => {}))
    const id = 'requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 2000 }) : setTimeout(warm, 1000)
    return () => ('cancelIdleCallback' in window ? cancelIdleCallback(id) : clearTimeout(id))
  }, [router])
  const start = useRef<{ x: number; y: number; at: number; dragging: boolean } | null>(null)
  const page = useRef<HTMLDivElement>(null)

  // Tab changes (tap or swipe) slide the whole screen in from the side it sits on; other screens fade up.
  const [shown, setShown] = useState({ path: pathname, dir: 0 })
  if (shown.path !== pathname) setShown({ path: pathname, dir: tabDirection(shown.path, pathname) })

  // The screen follows the finger (written straight to a CSS variable, no re-render per move), then commits or springs back.
  const setDrag = (px: number, live: boolean) => {
    const el = page.current
    if (!el) return
    el.classList.toggle('dragging', live)
    el.style.setProperty('--drag-x', `${px}px`)
  }
  const onTouchStart = (e: TouchEvent) => {
    // Inputs and anything marked data-no-swipe (sliders, horizontal carousels) keep their own gestures
    const ignore = e.touches.length > 1 || !(TABS as readonly string[]).includes(pathname) || (e.target as Element).closest('input, textarea, select, [data-no-swipe]')
    start.current = ignore ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY, at: e.timeStamp, dragging: false }
  }
  const onTouchMove = (e: TouchEvent) => {
    const s = start.current
    if (!s) return
    const dx = e.touches[0].clientX - s.x
    const dy = e.touches[0].clientY - s.y
    if (!s.dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) start.current = null // a scroll: let it be
      else if (Math.abs(dx) > 10) s.dragging = true
      if (!s.dragging) return
    }
    setDrag(dragOffset(pathname, dx), true)
  }
  const onTouchEnd = (e: TouchEvent) => {
    const s = start.current
    start.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const to = swipeTarget(pathname, s.x, t.clientX - s.x, t.clientY - s.y, window.innerWidth, e.timeStamp - s.at)
    if (to) {
      setDrag(0, true) // the new screen takes over where this one was; no spring back
      navigate({ to })
      requestAnimationFrame(() => page.current?.classList.remove('dragging'))
    } else setDrag(0, false)
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => { start.current = null; setDrag(0, false) }}
      // clip, not hidden: the slide-in from the right must not widen the page (the fixed nav jumped), and sticky headers keep working
      className="min-h-dvh overflow-x-clip lg:pl-60"
    >
      <div
        className="mx-auto max-w-[480px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:max-w-none lg:px-[clamp(1.5rem,3vw,4rem)] lg:pb-10"
      >
        {/* Keyed by path so each screen's sections animate in turn on arrival */}
        <div
          key={pathname}
          ref={page}
          className={`page-in ${shown.dir ? 'tab-in' : ''} flex flex-col gap-4 lg:mx-auto lg:w-full ${WIDE.includes(pathname) ? 'page-wide' : 'lg:max-w-[45rem]'}`}
          style={shown.dir ? ({ '--page-dx': `${shown.dir * 12}vw`, '--page-dy': '0px' } as CSSProperties) : undefined}
        >
          <Outlet />
        </div>
      </div>
      <BottomNav />
      <SideNav />
    </div>
  )
}
