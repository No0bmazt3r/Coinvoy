// Google One Tap on the login page (docs/GOOGLE_AUTH_PORTABLE.md §2 rule 6): Google's account picker slides in, and
// the ID token it gives goes to our API, which checks its signature and our nonce before signing in. Google's script
// loads only here, only when Google sign-in is set up; if anything fails, the normal Google button still works.
import { useEffect, useRef } from 'react'
import { api } from './api'

type Gsi = { initialize: (o: Record<string, unknown>) => void; prompt: () => void; cancel: () => void }
declare global {
  interface Window {
    google?: { accounts: { id: Gsi } }
  }
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gsi'))
    document.head.append(s)
  })

export function useGoogleOneTap(enabled: boolean, lang: 'ms' | 'en', onSignedIn: () => void, onFailed: (err: unknown) => void) {
  // The callbacks change every render; the prompt must not restart for that
  const handlers = useRef({ onSignedIn, onFailed })
  useEffect(() => {
    handlers.current = { onSignedIn, onFailed }
  })
  useEffect(() => {
    if (!enabled) return
    let stopped = false
    ;(async () => {
      const { clientId, nonce } = await api<{ clientId: string; nonce: string }>('/api/auth/google/one-tap')
      if (!window.google) await loadScript(`https://accounts.google.com/gsi/client?hl=${lang}`)
      if (stopped || !window.google) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce,
        context: 'signin',
        auto_select: false, // the rider always picks the account
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true, // the browser's own account sheet where supported (Chrome on Android)
        itp_support: true,
        callback: async ({ credential }: { credential: string }) => {
          try {
            await api('/api/auth/google/one-tap', { body: { credential } })
            handlers.current.onSignedIn()
          } catch (err) {
            handlers.current.onFailed(err)
          }
        },
      })
      window.google.accounts.id.prompt()
    })().catch(() => {}) // no One Tap (blocked script, Google off): the button below still signs in
    return () => {
      stopped = true
      window.google?.accounts.id.cancel()
    }
  }, [enabled, lang])
}
