// The swipeable tabs, left to right as in the bottom nav. Snap is an action, not a tab, so swipes skip it.
export const TABS = ['/', '/tabung', '/tanya', '/settings'] as const

const MIN_DX = 60 // px: shorter drags are taps or scroll jitter
const EDGE = 24 // px: swipes starting this close to the screen edge belong to the phone's own back gesture
const FLICK = 0.5 // px/ms: a quick flick commits even when the drag is short
const RUBBER = 0.25 // how far the page follows the finger when there's no tab that way

/** The tab a drag of dx leads to (dx < 0 is a drag to the left), or null at the ends and off the tabs. */
export function neighbour(path: string, dx: number): string | null {
  const i = (TABS as readonly string[]).indexOf(path)
  return i < 0 || !dx ? null : (TABS[i + (dx < 0 ? 1 : -1)] ?? null)
}

/** How far the page moves under the finger: 1:1 toward a tab, a short stretch toward nothing. */
export const dragOffset = (path: string, dx: number) => (neighbour(path, dx) ? dx : dx * RUBBER)

/** Where a released swipe on `path` leads, or null if it springs back. Commits past a third of the screen, or on a flick. */
export function swipeTarget(path: string, startX: number, dx: number, dy: number, screenWidth: number, ms = Infinity): string | null {
  if (Math.abs(dx) < MIN_DX || Math.abs(dx) < 1.5 * Math.abs(dy)) return null
  if (startX < EDGE || startX > screenWidth - EDGE) return null
  if (Math.abs(dx) < screenWidth / 3 && Math.abs(dx) / ms < FLICK) return null
  return neighbour(path, dx)
}

/** -1, 0 or 1: which way the screen slides when moving between two paths (0 if either isn't a tab). */
export function tabDirection(from: string, to: string): number {
  const a = (TABS as readonly string[]).indexOf(from)
  const b = (TABS as readonly string[]).indexOf(to)
  return a < 0 || b < 0 ? 0 : Math.sign(b - a)
}
