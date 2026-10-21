import { eq } from 'drizzle-orm'
import { expect, test } from 'vitest'
import { db, schema } from '../src/db/index.ts'
import { guideStats } from '../src/services/usage.ts'
import { demo } from './helpers.ts'

test('guide hints are remembered per account and come back on reset', async () => {
  const a = await demo()
  expect((await a.get('/api/auth/me')).body.user.seenTips).toEqual([])
  await a.post('/api/tips').send({ screen: 'gaji', action: 'seen' })
  await a.post('/api/tips').send({ screen: 'tabung', action: 'started' }) // starting alone doesn't retire the hint
  let user = (await a.post('/api/tips').send({ screen: 'tabung', action: 'completed' })).body.user
  expect(user.seenTips).toEqual(['gaji', 'tabung'])
  user = (await a.post('/api/tips').send({ screen: 'gaji', action: 'skipped' })).body.user
  expect(user.seenTips).toEqual(['gaji', 'tabung']) // no duplicates
  expect((await a.post('/api/tips').send({ screen: 'nowhere', action: 'seen' })).status).toBe(422)

  expect((await demo().then((b) => b.get('/api/auth/me'))).body.user.seenTips).toEqual([]) // a new rider starts fresh
  expect((await a.delete('/api/tips')).body.user.seenTips).toEqual([])
})

test('tour events reach the usage view, real riders only', async () => {
  const a = await demo()
  for (const action of ['started', 'completed']) await a.post('/api/tips').send({ screen: 'snap', action })
  expect(await guideStats(db)).toEqual({}) // demo riders don't count
  const me = (await a.get('/api/auth/me')).body.user
  await db.update(schema.users).set({ isDemo: false }).where(eq(schema.users.id, Number(me.id)))
  expect(await guideStats(db)).toEqual({ snap: { started: 1, completed: 1, skipped: 0 } })
})
