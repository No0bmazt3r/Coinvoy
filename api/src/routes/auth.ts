// Google sign-in on OpenID Connect (authorization code + PKCE), no auth vendor (GOOGLE_AUTH_PORTABLE.md),
// plus the judges' demo login (FR-AUTH-3).
import { and, eq, lt, sql } from 'drizzle-orm'
import { Router, type Request, type Response } from 'express'
import { cookieOptions, createSession, endSession, logAuthEvent, randomToken, readCookie, requireUser, setSessionCookie, sha256, userOf } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { env, googleConfigured } from '../env.ts'
import { ApiError } from '../errors.ts'
import { errorFields, log } from '../log.ts'
import { PERSONAS, type PersonaKey, seedDemo } from '../services/demo.ts'
import { userJson } from '../services/profile.ts'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']
const FLOW_COOKIE = 'google_flow'
const FLOW_PATH = '/api/auth/google'
const DEMO_TTL_MS = 24 * 60 * 60 * 1000
const redirectUri = () => `${env.APP_URL}/api/auth/google/callback`

type FailReason = 'cancelled' | 'state' | 'exchange' | 'token' | 'not_configured'
type IdTokenClaims = { iss: string; aud: string; exp: number; nonce?: string; sub: string; email: string; email_verified: boolean; name?: string; picture?: string }

// Every failed sign-in is recorded, then the browser goes back to the login page with a reason.
async function fail(req: Request, res: Response, reason: FailReason, email?: string) {
  await logAuthEvent(db, req, 'login_failed', { reason, email })
  res.clearCookie(FLOW_COOKIE, { path: FLOW_PATH })
  res.redirect(`${env.APP_URL}/login?error=${reason}`)
}

// Overridable in tests; the real exchange posts the code + secret + PKCE verifier to Google, server to server.
export const google = {
  async exchange(code: string, verifier: string): Promise<string> {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    })
    if (!tokenRes.ok) throw new Error(`${tokenRes.status} ${await tokenRes.text()}`)
    return ((await tokenRes.json()) as { id_token: string }).id_token
  },
}

export const authRouter = Router()

// 1. Send the browser to Google with a fresh state (CSRF), PKCE verifier and nonce (replay).
authRouter.get('/google', async (req, res) => {
  if (!googleConfigured()) return fail(req, res, 'not_configured')
  const state = randomToken()
  const verifier = randomToken()
  const nonce = randomToken()
  res.cookie(FLOW_COOKIE, `${state}.${verifier}.${nonce}`, cookieOptions(10 * 60 * 1000, FLOW_PATH))
  const url = new URL(GOOGLE_AUTH_URL)
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: sha256(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  res.redirect(url.href)
})

// 2. Google sends the browser back here with a one-time code.
authRouter.get('/google/callback', async (req, res) => {
  const [state, verifier, nonce] = readCookie(req, FLOW_COOKIE)?.split('.') ?? []
  res.clearCookie(FLOW_COOKIE, { path: FLOW_PATH })
  const { code, state: returnedState, error } = req.query
  if (error) return fail(req, res, 'cancelled')
  if (typeof code !== 'string' || !state || !verifier || returnedState !== state) return fail(req, res, 'state')

  // 3. Exchange the code for tokens, server to server.
  let idToken: string
  try {
    idToken = await google.exchange(code, verifier)
  } catch (err) {
    log('error', 'google token exchange failed', errorFields(err))
    return fail(req, res, 'exchange')
  }

  // 4. Check the claims. The token came straight from Google's token endpoint over TLS, so per OIDC Core
  //    §3.1.3.7 the TLS check stands in for verifying its signature.
  let claims: IdTokenClaims
  try {
    claims = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString()) as IdTokenClaims
  } catch {
    return fail(req, res, 'token')
  }
  const valid = GOOGLE_ISSUERS.includes(claims.iss) && claims.aud === env.GOOGLE_CLIENT_ID && claims.exp * 1000 > Date.now() && claims.nonce === nonce && claims.email_verified === true
  if (!valid) return fail(req, res, 'token', claims.email)

  // 5. Find or create the user (keyed on `sub`), start a session and record it in one transaction.
  const token = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.users)
      .values({ googleSub: claims.sub, email: claims.email, displayName: claims.name ?? claims.email.split('@')[0]!, avatarUrl: claims.picture ?? null, lastLoginAt: new Date() })
      .onConflictDoUpdate({
        target: schema.users.googleSub,
        set: { email: claims.email, displayName: claims.name ?? claims.email.split('@')[0]!, avatarUrl: claims.picture ?? null, lastLoginAt: new Date() },
      })
      .returning({ id: schema.users.id, inserted: sql<boolean>`(xmax = 0)` }) // xmax = 0 only for a fresh insert
    const { id: userId, inserted } = row!
    const t = await createSession(tx, req, userId)
    if (inserted) await logAuthEvent(tx, req, 'signup', { userId, email: claims.email })
    await logAuthEvent(tx, req, 'login', { userId, email: claims.email })
    return t
  })
  setSessionCookie(res, token) // only after commit
  res.redirect(`${env.APP_URL}/`)
})

// A fresh temporary demo rider per tap, so each judge has their own copy (FR-AUTH-3, FR-DEMO-1).
// ?persona=lina opens Kak Lina's Jurang story instead of Abang Faiz; ?empty starts at onboarding.
authRouter.post('/demo', async (req, res) => {
  if (!env.DEMO_ENABLED) throw new ApiError(404, 'demo_disabled', 'Demo tidak tersedia.', "The demo isn't available.")
  const persona: PersonaKey = req.query.persona === 'lina' ? 'lina' : 'faiz'
  // ponytail: expired demo users are cleaned up here instead of by a scheduler; add a job if demo traffic grows.
  await db.delete(schema.users).where(and(eq(schema.users.isDemo, true), lt(schema.users.createdAt, new Date(Date.now() - DEMO_TTL_MS))))
  const token = await db.transaction(async (tx) => {
    const [user] = await tx.insert(schema.users).values({ email: 'demo@coinvoy.invalid', displayName: PERSONAS[persona].name, isDemo: true, lastLoginAt: new Date() }).returning()
    const t = await createSession(tx, req, user!.id)
    await logAuthEvent(tx, req, 'signup', { userId: user!.id, email: user!.email })
    await logAuthEvent(tx, req, 'login', { userId: user!.id, email: user!.email })
    return { t, user: user! }
  })
  if (req.query.empty === undefined) await seedDemo(token.user, persona)
  setSessionCookie(res, token.t)
  res.status(204).end()
})

authRouter.post('/logout', async (req, res) => {
  await endSession(req, res)
  res.status(204).end()
})

authRouter.get('/me', requireUser, async (_req, res) => {
  res.json({ user: await userJson(userOf(res)) })
})
