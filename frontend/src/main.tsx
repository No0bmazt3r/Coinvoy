import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans/wght.css' // self-hosted, font-display: swap; only the subsets in use download
import { RouteSkeleton } from './components/Skeleton'
import { Splash } from './components/Splash'
import { I18nProvider } from './i18n/I18nProvider'
import { meQuery } from './lib/api'
import { restoreAppearance } from './lib/appearance'
import { routeTree } from './routeTree.gen'
import './index.css'

restoreAppearance()
// Data counts as fresh for 30 s: moving between screens shows the cached data without refetching every query again.
// Saves still update at once, because every mutation invalidates what it changed.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
// Routes are code-split; a screen whose chunk is slow to arrive shows a skeleton after 150 ms (not the default 1 s of
// a frozen previous screen), held 200 ms so it doesn't flicker. Screens never wait on data: they render at once and
// show their own skeletons while their queries load.
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0, // TanStack Query owns caching; let every preload reach the loader (TanStack's advice)
  defaultPendingComponent: RouteSkeleton,
  defaultPendingMs: 150,
  defaultPendingMinMs: 200,
})

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
