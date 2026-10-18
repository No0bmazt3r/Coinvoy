// Sessions, cookies, audit log and requireUser (docs/GOOGLE_AUTH_PORTABLE.md §6, ported to Drizzle).
import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { type Db, db, schema } from './db/index.ts'
import { env } from './env.ts'
import { ApiError } from './errors.ts'

export const SESSION_COOKIE = 'sid'
export type User = typeof schema.users.$inferSelect

export const randomToken = () => randomBytes(32).toString('base64url')
export const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url')

export function readCookie(req: Request, name: string) {
  for (const part of req.headers.cookie?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
}

export const cookieOptions = (maxAgeMs: number, path = '/') => ({ httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path, maxAge: maxAgeMs }) as const

const sessionTtlMs = () => env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
const client = (req: Request) => ({ ip: req.ip ?? null, userAgent: req.get('user-agent')?.slice(0, 500) ?? null })

export type AuthEvent = 'signup' | 'login' | 'login_failed' | 'logout'

export async function logAuthEvent(tx: Db, req: Request, event: AuthEvent, details: { userId?: number; email?: string; reason?: string } = {}) {
  await tx.insert(schema.authEvents).values({ event, userId: details.userId ?? null, email: details.email ?? null, reason: details.reason ?? null, ...client(req) })
}

// Returns the raw token; only its hash is stored. Set the cookie after the transaction commits.
export async function createSession(tx: Db, req: Request, userId: number) {
  const token = randomToken()
  await tx.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())) // cheap housekeeping
  await tx.insert(schema.sessions).values({ tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + sessionTtlMs()), ...client(req) })
  return token
}

export const setSessionCookie = (res: Response, token: string) => res.cookie(SESSION_COOKIE, token, cookieOptions(sessionTtlMs()))

export async function endSession(req: Request, res: Response) {
  const token = readCookie(req, SESSION_COOKIE)
  if (token) {
    const [row] = await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token))).returning({ userId: schema.sessions.userId })
    if (row) {
      const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, row.userId))
      await logAuthEvent(db, req, 'logout', { userId: row.userId, email: user?.email })
    }
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' })
}

// Puts the signed-in user on res.locals.user, or answers 401.
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token) throw new ApiError(401, 'not_signed_in', 'Sila log masuk.', 'Please sign in.')
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
  if (!row) throw new ApiError(401, 'session_expired', 'Sesi tamat. Sila log masuk semula.', 'Session expired. Please sign in again.')
  res.locals.user = row.user
  next()
}

/** The signed-in rider inside a route behind requireUser. */
export const userOf = (res: Response) => res.locals.user as User
