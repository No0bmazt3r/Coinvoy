import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Splash } from './components/Splash'
import { I18nProvider } from './i18n/I18nProvider'
import { meQuery } from './lib/api'
import { routeTree } from './routeTree.gen'
import './index.css'

const queryClient = new QueryClient()
const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const SPLASH_MIN_MS = 1200

// The startup screen (FR-SHELL-1) stays up until the session check answers and the minimum time has passed.
function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const minimum = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS))
    Promise.all([queryClient.prefetchQuery(meQuery), minimum]).then(() => setReady(true))
  }, [])
  return ready ? <RouterProvider router={router} /> : <Splash />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
