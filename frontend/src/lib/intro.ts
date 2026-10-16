// The first-launch walkthrough shows once per device. Storage can throw (private mode); then it just shows again.
const KEY = 'coinvoy.introSeen'

export function introSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // nothing to do
  }
}
