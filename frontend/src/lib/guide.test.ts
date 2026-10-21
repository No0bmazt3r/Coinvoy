import { describe, expect, it } from 'vitest'
import en from '../i18n/en.json'
import ms from '../i18n/ms.json'
import { STEPS, type GuideScreen, visibleTargets } from './guide'

describe('screen guides', () => {
  it('have a hint and a title and body for every step, in BM and English', () => {
    for (const dict of [ms, en] as Record<string, string>[]) {
      for (const [screen, targets] of Object.entries(STEPS) as [GuideScreen, string[]][]) {
        expect(dict[`guide.hint.${screen}`], `guide.hint.${screen}`).toBeTruthy()
        for (const target of targets) {
          expect(dict[`guide.${screen}.${target}.title`], `${screen}.${target}.title`).toBeTruthy()
          expect(dict[`guide.${screen}.${target}.body`], `${screen}.${target}.body`).toBeTruthy()
        }
      }
    }
  })

  it('keep tours short', () => {
    // Gaji lists both its states; at most 4 of its targets are ever on screen together
    for (const [screen, targets] of Object.entries(STEPS)) if (screen !== 'gaji') expect(targets.length).toBeLessThanOrEqual(4)
  })

  it('skip targets that are missing or hidden, keeping the order', () => {
    const el = (shown: boolean) => ({ getClientRects: () => (shown ? [{}] : []) }) as unknown as Element
    const page: Record<string, Element[]> = { salary: [el(true)], transfer: [], 'snap-nav': [el(false), el(true)] }
    const root = { querySelectorAll: (sel: string) => page[sel.match(/"(.+)"/)![1]!] ?? [] } as unknown as ParentNode
    expect(visibleTargets(['salary', 'risk', 'transfer', 'snap-nav'], root).map((x) => x.target)).toEqual(['salary', 'snap-nav'])
    expect(visibleTargets(['snap-nav'], root)[0]!.el).toBe(page['snap-nav']![1]) // the visible one of two (desktop vs phone)
  })
})
