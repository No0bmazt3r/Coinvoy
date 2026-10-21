import { describe, expect, it } from 'vitest'
import { dragOffset, swipeTarget, tabDirection } from './tabs'

const W = 400
const swipe = (path: string, dx: number, dy = 0, startX = 200, ms?: number) => swipeTarget(path, startX, dx, dy, W, ms)

describe('swipeTarget', () => {
  it('moves to the neighbouring tab, skipping Snap', () => {
    expect(swipe('/', -150)).toBe('/tabung')
    expect(swipe('/tabung', -150)).toBe('/tanya')
    expect(swipe('/tanya', 150)).toBe('/tabung')
  })

  it('stops at the ends', () => {
    expect(swipe('/', 150)).toBeNull()
    expect(swipe('/settings', -150)).toBeNull()
  })

  it('ignores short, vertical-ish and edge swipes', () => {
    expect(swipe('/', -40)).toBeNull()
    expect(swipe('/', -100, 80)).toBeNull()
    expect(swipe('/', 100, 0, 10)).toBeNull()
    expect(swipe('/tabung', -100, 0, W - 10)).toBeNull()
  })

  it('does nothing off the tabs', () => {
    expect(swipe('/snap', -150)).toBeNull()
    expect(swipe('/rekod', 150)).toBeNull()
  })

  it('springs back under a third of the screen, unless flicked', () => {
    expect(swipe('/', -100)).toBeNull()
    expect(swipe('/', -100, 0, 200, 1000)).toBeNull()
    expect(swipe('/', -100, 0, 200, 120)).toBe('/tabung')
  })
})

describe('dragOffset', () => {
  it('follows the finger toward a tab and stretches toward nothing', () => {
    expect(dragOffset('/', -80)).toBe(-80)
    expect(dragOffset('/', 80)).toBe(20)
    expect(dragOffset('/rekod', -80)).toBe(-20)
  })
})

describe('tabDirection', () => {
  it('slides by tab order, and not at all off the tabs', () => {
    expect(tabDirection('/', '/tanya')).toBe(1)
    expect(tabDirection('/settings', '/tabung')).toBe(-1)
    expect(tabDirection('/', '/snap')).toBe(0)
  })
})
