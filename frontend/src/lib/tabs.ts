// The swipeable tabs, left to right as in the bottom nav. Snap is an action, not a tab, so swipes skip it.
export const TABS = ['/', '/tabung', '/tanya', '/settings'] as const

const MIN_DX = 60 // px: shorter drags are taps or scroll jitter
const EDGE = 24 // px: swipes starting this close to the screen edge belong to the phone's own back gesture

/** Where a horizontal swipe on `path` leads, or null if it isn't a tab swipe. dx < 0 is a swipe to the left. */
export function swipeTarget(path: string, startX: number, dx: number, dy: number, screenWidth: number): string | null {
  const i = (TABS as readonly string[]).indexOf(path)
  if (i < 0 || Math.abs(dx) < MIN_DX || Math.abs(dx) < 1.5 * Math.abs(dy)) return null
  if (startX < EDGE || startX > screenWidth - EDGE) return null
  return TABS[i + (dx < 0 ? 1 : -1)] ?? null
}

/** -1, 0 or 1: which way the screen slides when moving between two paths (0 if either isn't a tab). */
export function tabDirection(from: string, to: string): number {
  const a = (TABS as readonly string[]).indexOf(from)
  const b = (TABS as readonly string[]).indexOf(to)
  return a < 0 || b < 0 ? 0 : Math.sign(b - a)
}
