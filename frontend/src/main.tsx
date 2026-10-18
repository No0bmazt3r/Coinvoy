import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Splash } from './components/Splash'
import { I18nProvider } from './i18n/I18nProvider'
import { meQuery } from './lib/api'
import { restoreAppearance } from './lib/appearance'
import { routeTree } from './routeTree.gen'
import './index.css'

restoreAppearance()
const queryClient = new QueryClient()
const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Long enough for the logo animation to finish (FR-SHELL-1 asks for at least 1.2 s).
const SPLASH_MIN_MS = 1600

// The startup screen (FR-SHELL-1) stays up until the session check answers and the minimum time has passed.
function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const minimum = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS))
    Promise.all([queryClient.prefetchQuery(meQuery), minimum]).then(() => setReady(true))
  }, [])
  return ready ? <RouterProvider router={router} /> : <Splash />
}

// Offline shell + last home data (NFR-3). Production only, so dev always sees fresh code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
