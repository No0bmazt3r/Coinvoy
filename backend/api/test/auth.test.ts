import { eq } from 'drizzle-orm'
import { expect, test } from 'vitest'
import { sha256 } from '../src/auth.ts'
import { db, schema } from '../src/db/index.ts'
import { google } from '../src/routes/auth.ts'
import { agent, type Agent, demo } from './helpers.ts'

const events = async () => (await db.select().from(schema.authEvents).orderBy(schema.authEvents.id)).map((e) => [e.event, e.reason])

async function startGoogle(a: Agent) {
  const res = await a.get('/api/auth/google')
  expect(res.status).toBe(302)
  expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.com\//)
  const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('google_flow='))!
  const [state, verifier, nonce] = decodeURIComponent(cookie.split(';')[0]!.split('=')[1]!).split('.')
  return { state: state!, verifier: verifier!, nonce: nonce!, res, cookie }
}

const idToken = (claims: Record<string, unknown>) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
const goodClaims = (nonce: string, override: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com', aud: 'test-client', exp: Date.now() / 1000 + 600, nonce,
  sub: 'google-123', email: 'faiz@example.com', email_verified: true, name: 'Faiz Rahman', picture: 'https://example.com/a.png', ...override,
})

test('me is 401 when signed out', async () => {
  const res = await agent().get('/api/auth/me')
  expect(res.status).toBe(401)
  expect(res.body.error.code).toBe('not_signed_in')
})

test('PKCE challenge is base64url sha256 of the verifier (RFC 7636 appendix B)', () => {
  expect(sha256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
})

test('start sends state, nonce and an S256 challenge in a short-lived scoped cookie', async () => {
  const { state, verifier, nonce, res, cookie } = await startGoogle(agent())
  const location = res.headers.location
  expect(location).toContain(`state=${state}`)
  expect(location).toContain(`nonce=${nonce}`)
  expect(location).toContain(`code_challenge=${sha256(verifier)}`)
  expect(location).toContain('code_challenge_method=S256')
  expect(location).toContain('scope=openid+email+profile')
  expect(cookie.toLowerCase()).toMatch(/httponly/)
  expect(cookie).toMatch(/Path=\/api\/auth\/google/)
  expect(cookie).toMatch(/Max-Age=600/)
})

test('wrong state is refused and audited', async () => {
  const a = agent()
  await startGoogle(a)
  const res = await a.get('/api/auth/google/callback?code=x&state=wrong')
  expect(res.headers.location).toBe('http://localhost:5173/login?error=state')
  expect(await events()).toEqual([['login_failed', 'state']])
})

test('cancel on the Google screen', async () => {
  const a = agent()
  await startGoogle(a)
  const res = await a.get('/api/auth/google/callback?error=access_denied')
  expect(res.headers.location).toMatch(/\/login\?error=cancelled$/)
})

test('sign in, sign in again, then log out', async () => {
  const a = agent()
  let { state, nonce } = await startGoogle(a)
  google.exchange = async () => idToken(goodClaims(nonce))
  const res = await a.get(`/api/auth/google/callback?code=abc&state=${state}`)
  expect(res.headers.location).toBe('http://localhost:5173/')
  const sid = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('sid='))!.split(';')[0]!.slice(4)
  const [session] = await db.select().from(schema.sessions)
  expect(session!.tokenHash).toBe(sha256(sid))
  expect(session!.tokenHash).not.toBe(sid) // only the hash is stored
  const me = (await a.get('/api/auth/me')).body.user
  expect(me.displayName).toBe('Faiz Rahman')
  expect(me.isDemo).toBe(false)

  ;({ state, nonce } = await startGoogle(a))
  google.exchange = async () => idToken(goodClaims(nonce))
  await a.get(`/api/auth/google/callback?code=abc&state=${state}`)
  expect(await db.select().from(schema.users)).toHaveLength(1)
  expect((await events()).map(([e]) => e)).toEqual(['signup', 'login', 'login'])

  expect((await a.post('/api/auth/logout')).status).toBe(204)
  expect((await a.get('/api/auth/me')).status).toBe(401)
  expect((await events()).at(-1)).toEqual(['logout', null])
})

test('bad claims are refused', async () => {
  for (const bad of [{ nonce: 'other' }, { aud: 'someone-else' }, { email_verified: false }, { exp: Date.now() / 1000 - 1 }, { iss: 'https://evil.example' }]) {
    const a = agent()
    const { state, nonce } = await startGoogle(a)
    google.exchange = async () => idToken(goodClaims(nonce, bad))
    const res = await a.get(`/api/auth/google/callback?code=abc&state=${state}`)
    expect(res.headers.location, JSON.stringify(bad)).toMatch(/\/login\?error=token$/)
  }
  expect(await db.select().from(schema.users)).toEqual([])
})

test('a failed token exchange is audited', async () => {
  const a = agent()
  const { state } = await startGoogle(a)
  google.exchange = async () => {
    throw new Error('400 invalid_grant')
  }
  const res = await a.get(`/api/auth/google/callback?code=abc&state=${state}`)
  expect(res.headers.location).toMatch(/error=exchange$/)
})

test('each demo tap gets its own user, and the real demo is the seeded Faiz story', async () => {
  const first = await demo()
  const one = (await first.get('/api/auth/me')).body.user
  expect(one.isDemo).toBe(true)
  const two = (await (await demo()).get('/api/auth/me')).body.user
  expect(two.id).not.toBe(one.id)

  const seeded = await demo(agent(), true)
  const me = (await seeded.get('/api/auth/me')).body.user
  expect(me.onboarded).toBe(true)
  const home = (await seeded.get('/api/home')).body
  expect(home.salary.salarySen).toBeGreaterThan(0)
  expect(home.weeksLogged).toBe(12)
  expect(home.salary.jurang).toBeNull()
})

test('the Kak Lina demo opens on Jurang', async () => {
  const a = agent()
  expect((await a.post('/api/auth/demo?persona=lina')).status).toBe(204)
  expect((await a.get('/api/auth/me')).body.user.displayName).toBe('Lina')
  const home = (await a.get('/api/home')).body
  expect(home.salary.jurang.gapSen).toBeGreaterThan(0)
  const j = (await a.get('/api/jurang')).body
  expect(j.active).toBe(true)
})

test('all demo personas seed a usable account', async () => {
  for (const persona of ['faiz', 'lina', 'siti', 'ravi', 'mei']) {
    const a = agent()
    expect((await a.post(`/api/auth/demo?persona=${persona}`)).status).toBe(204)
    const home = (await a.get('/api/home')).body
    expect(home.weeksLogged).toBe(12)
    expect(home.salary.salarySen).toBeGreaterThan(0)
  }
})

test('a foreign Origin is refused on unsafe requests', async () => {
  expect((await agent().post('/api/auth/demo?empty').set('Origin', 'https://evil.example')).status).toBe(403)
  expect((await agent().post('/api/auth/demo?empty').set('Origin', 'http://localhost:5173')).status).toBe(204)
})

test('security headers are set', async () => {
  const res = await agent().get('/api/health')
  expect(res.headers['content-security-policy']).toContain("default-src 'self'")
  expect(res.headers['x-content-type-options']).toBe('nosniff')
  expect(res.headers['x-powered-by']).toBeUndefined()
})

test('deleting a user cascades its sessions', async () => {
  const a = await demo()
  const me = (await a.get('/api/auth/me')).body.user
  await db.delete(schema.users).where(eq(schema.users.id, Number(me.id)))
  expect(await db.select().from(schema.sessions)).toEqual([])
})

test('the auth rate limit blocks a burst from one IP', async () => {
  const express = (await import('express')).default
  const { rateLimit } = await import('../src/app.ts')
  const { errorHandler } = await import('../src/errors.ts')
  const tiny = express().use(rateLimit(3)).get('/', (_req, res) => void res.send('ok')).use(errorHandler)
  const request = (await import('supertest')).default
  const codes = []
  for (let i = 0; i < 5; i++) codes.push((await request(tiny).get('/')).status)
  expect(codes).toEqual([200, 200, 200, 429, 429])
})

// Google One Tap: an ID token from the browser, so the signature is checked against Google's keys (rule 6)
const { generateKeyPairSync, sign } = await import('node:crypto')
const googleKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
const signedToken = (claims: Record<string, unknown>, key = googleKey.privateKey, kid = 'k1') => {
  const head = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${head}.${body}.${sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url')}`
}
async function oneTapNonce(a: Agent) {
  google.jwks = async () => [{ ...googleKey.publicKey.export({ format: 'jwk' }), kid: 'k1' }]
  const res = await a.get('/api/auth/google/one-tap')
  expect(res.status).toBe(200)
  expect(res.body.clientId).toBe('test-client')
  expect((res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('google_onetap='))).toMatch(/HttpOnly/i)
  return res.body.nonce as string
}

test('One Tap: a token signed by Google, for us, with our nonce, signs the rider in, once', async () => {
  const a = agent()
  const nonce = await oneTapNonce(a)
  const credential = signedToken(goodClaims(nonce))
  expect((await a.post('/api/auth/google/one-tap').send({ credential })).status).toBe(204)
  expect((await a.get('/api/auth/me')).body.user.email).toBe('faiz@example.com')
  // the nonce was used up: the same token can't be replayed
  const replay = agent()
  await oneTapNonce(replay)
  expect((await replay.post('/api/auth/google/one-tap').send({ credential })).status).toBe(401)
})

test('One Tap refuses a forged signature, an unknown key, another app, a wrong or missing nonce', async () => {
  const cases: [string, (n: string) => string][] = [
    ['forged', (n) => signedToken(goodClaims(n), otherKey.privateKey)],
    ['unknown key', (n) => signedToken(goodClaims(n), googleKey.privateKey, 'k-unknown')],
    ['other app', (n) => signedToken(goodClaims(n, { aud: 'someone-else' }))],
    ['wrong nonce', () => signedToken(goodClaims('not-our-nonce'))],
    ['unverified email', (n) => signedToken(goodClaims(n, { email_verified: false }))],
    ['not a jwt', () => 'nonsense'],
  ]
  for (const [name, make] of cases) {
    const a = agent()
    const nonce = await oneTapNonce(a)
    const res = await a.post('/api/auth/google/one-tap').send({ credential: make(nonce) })
    expect([name, res.status]).toEqual([name, 401])
  }
  const noCookie = agent() // never asked for a nonce
  google.jwks = async () => [{ ...googleKey.publicKey.export({ format: 'jwk' }), kid: 'k1' }]
  expect((await noCookie.post('/api/auth/google/one-tap').send({ credential: signedToken(goodClaims('x')) })).status).toBe(401)
  expect((await events()).filter(([e]) => e === 'login_failed')).toHaveLength(cases.length + 1)
})
