// Theme override and the cosmetic accent riders unlock with streaks. Saved locally too,
// so the login screen and splash follow the choice before anyone is signed in.
import type { Accent, User } from './api'

const THEME = 'coinvoy.theme'
const ACCENT = 'coinvoy.accent'

export function applyAppearance(theme: User['theme'], accent: Accent) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  if (accent === 'lime') delete root.dataset.accent
  else root.dataset.accent = accent
  try {
    localStorage.setItem(THEME, theme)
    localStorage.setItem(ACCENT, accent)
  } catch {
    // storage blocked: it applies for this visit only
  }
}

export function restoreAppearance() {
  try {
    const theme = localStorage.getItem(THEME)
    const accent = localStorage.getItem(ACCENT)
    applyAppearance(theme === 'light' || theme === 'dark' ? theme : 'system', (accent as Accent) || 'lime')
  } catch {
    // nothing saved
  }
}

/** Whether the app is showing dark mode right now: the rider's choice, or the phone's when it follows the system. */
export function isDark() {
  const theme = document.documentElement.dataset.theme
  return theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}
