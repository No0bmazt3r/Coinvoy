// What each screen guide points at (components/Guide.tsx). Kept apart from the components so it can be tested alone.

export type GuideScreen = 'gaji' | 'tabung' | 'snap' | 'tanya' | 'profil'

// Each step points at an element marked data-tour="<target>". Gaji lists both states (with a salary, and before the
// first one); only the targets on screen are shown.
export const STEPS: Record<GuideScreen, string[]> = {
  gaji: ['salary', 'risk', 'transfer', 'snap-start', 'how', 'snap-nav'],
  tabung: ['total', 'penampan', 'add-pot'],
  snap: ['camera', 'files', 'manual'],
  tanya: ['ask', 'tools'],
  profil: ['work', 'privacy', 'records'],
}

/** The targets of a tour that are really on screen (a hidden desktop or phone variant doesn't count). Exported for tests. */
export function visibleTargets(targets: string[], root: ParentNode = document): { target: string; el: Element }[] {
  return targets.flatMap((target) => {
    const el = [...root.querySelectorAll(`[data-tour="${target}"]`)].find((e) => e.getClientRects().length > 0)
    return el ? [{ target, el }] : []
  })
}
