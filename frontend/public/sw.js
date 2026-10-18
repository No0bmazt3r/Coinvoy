// Offline support (NFR-3): the app shell and the last home data load offline, read-only (architecture §11).
// Hashed build assets are cache-first (a change means a new file name); pages and the two read endpoints are
// network-first with the cached copy as the fallback. Nothing else personal is ever cached, and sign-out clears it.
const SHELL = 'coinvoy-shell-v1'
const DATA = 'coinvoy-data-v2'
const OFFLINE_API = ['/api/auth/me', '/api/home', '/api/pots'] // who you are, plus the two screens shown offline

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/logo.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(fallbackUrl ?? request, res.clone())
    return res
  } catch {
    return (await cache.match(fallbackUrl ?? request)) ?? Response.error()
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.open(SHELL).then(async (c) => (await c.match(e.request)) ?? fetch(e.request).then((res) => (res.ok && c.put(e.request, res.clone()), res))))
  } else if (OFFLINE_API.includes(url.pathname)) {
    e.respondWith(networkFirst(e.request, DATA))
  } else if (e.request.mode === 'navigate' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/o/')) {
    e.respondWith(networkFirst(e.request, SHELL, '/'))
  }
})

// Sign-out and account deletion clear the cached personal data.
self.addEventListener('message', (e) => {
  if (e.data === 'clear-data') caches.delete(DATA)
})
