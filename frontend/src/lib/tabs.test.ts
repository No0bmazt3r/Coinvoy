import { describe, expect, it } from 'vitest'
import { swipeTarget, tabDirection } from './tabs'

const W = 400
const swipe = (path: string, dx: number, dy = 0, startX = 200) => swipeTarget(path, startX, dx, dy, W)

describe('swipeTarget', () => {
  it('moves to the neighbouring tab, skipping Snap', () => {
    expect(swipe('/', -100)).toBe('/tabung')
    expect(swipe('/tabung', -100)).toBe('/tanya')
    expect(swipe('/tanya', 100)).toBe('/tabung')
  })

  it('stops at the ends', () => {
    expect(swipe('/', 100)).toBeNull()
    expect(swipe('/settings', -100)).toBeNull()
  })

  it('ignores short, vertical-ish and edge swipes', () => {
    expect(swipe('/', -40)).toBeNull()
    expect(swipe('/', -100, 80)).toBeNull()
    expect(swipe('/', 100, 0, 10)).toBeNull()
    expect(swipe('/tabung', -100, 0, W - 10)).toBeNull()
  })

  it('does nothing off the tabs', () => {
    expect(swipe('/snap', -100)).toBeNull()
    expect(swipe('/rekod', 100)).toBeNull()
  })
})

describe('tabDirection', () => {
  it('slides by tab order, and not at all off the tabs', () => {
    expect(tabDirection('/', '/tanya')).toBe(1)
    expect(tabDirection('/settings', '/tabung')).toBe(-1)
    expect(tabDirection('/', '/snap')).toBe(0)
  })
})
