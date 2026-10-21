import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express, { type RequestHandler } from 'express'
import { env, googleConfigured, llmConfigured } from './env.ts'
import { ApiError, errorHandler } from './errors.ts'
import { requestLog } from './log.ts'
import { accountRouter } from './routes/account.ts'
import { adminRouter } from './routes/admin.ts'
import { advisorRouter } from './routes/advisor.ts'
import { authRouter } from './routes/auth.ts'
import { benefitsRouter } from './routes/benefits.ts'
import { expensesRouter } from './routes/expenses.ts'
import { homeRouter } from './routes/home.ts'
import { profileRouter } from './routes/profile.ts'
import { pushRouter } from './routes/push.ts'
import { recordsRouter } from './routes/records.ts'
import { snapRouter } from './routes/snap.ts'
import { weeksRouter } from './routes/weeks.ts'

const DIST = fileURLToPath(new URL('../../frontend/dist', import.meta.url))
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Security headers. Allows Google profile pictures, inline styles, and Google's sign-in script for One Tap.
const GSI = 'https://accounts.google.com/gsi/'
const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'Content-Security-Policy':
      `default-src 'self'; img-src 'self' data: blob: https://*.googleusercontent.com; style-src 'self' 'unsafe-inline' ${GSI}style; script-src 'self' ${GSI}client; connect-src 'self' ${GSI}; frame-src ${GSI}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...(env.COOKIE_SECURE ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  })
  next()
}

// CSRF defence on top of SameSite=Lax: browsers send Origin on unsafe requests, so a foreign one is refused.
const sameOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin')
  if (UNSAFE.has(req.method) && origin && origin !== new URL(env.APP_URL).origin) throw new ApiError(403, 'bad_origin', 'Permintaan ditolak.', 'Request refused.')
  next()
}

// Simple for now: counted in memory per IP. Move it to the database if we run more than one API server.
export function rateLimit(perMinute: number): RequestHandler {
  const buckets = new Map<string, { tokens: number; at: number }>()
  return (req, _res, next) => {
    const key = req.ip ?? 'unknown'
    const now = Date.now()
    const b = buckets.get(key) ?? { tokens: perMinute, at: now }
    b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute)
    b.at = now
    if (b.tokens < 1) throw new ApiError(429, 'rate_limited', 'Terlalu banyak cubaan. Tunggu sebentar.', 'Too many attempts. Wait a moment.')
    b.tokens -= 1
    buckets.set(key, b)
    next()
  }
}

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY) // proxy hops in front (TRUST_PROXY), so req.ip is the real client
  app.use(requestLog)
  app.use(securityHeaders)
  app.use(express.json({ limit: '100kb' }))
  app.use(sameOrigin)

  app.get('/api/health', (_req, res) => void res.json({ ok: true }))
  // Public facts the privacy page shows: who processes screenshots and chat, and where.
  app.get('/api/meta', (_req, res) =>
    void res.json({ llmEnabled: llmConfigured(), llmProvider: env.LLM_PROVIDER_NAME || null, llmRegion: env.LLM_REGION_NOTE || null, noticeVersion: '2026-10', googleEnabled: googleConfigured(), privacyContact: env.PRIVACY_CONTACT_EMAIL || null }),
  )
  app.use('/api/auth', rateLimit(env.AUTH_RATE_PER_MIN), authRouter)
  app.use('/api', profileRouter, weeksRouter, homeRouter, snapRouter, advisorRouter, benefitsRouter, expensesRouter, pushRouter, adminRouter, accountRouter)
  app.use(recordsRouter)
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'not_found', 'Tidak dijumpai.', 'Not found.')))

  // One service serves the API and the PWA: same origin, first-party cookies, no CORS.
  if (existsSync(DIST)) {
    app.use(express.static(DIST, { index: false, maxAge: '1h' }))
    app.get(/^\/(?!api\/|o\/).*/, (_req, res) => res.sendFile(`${DIST}/index.html`))
  }
  app.use(errorHandler)
  return app
}
