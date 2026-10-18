import { expect, test } from 'vitest'
import { addWeeks } from '../src/lib/weeks.ts'
import { agent, demo, onboard, logHistory, rider, THIS_WEEK } from './helpers.ts'

test('the Penyata is locked until 12 weeks', async () => {
  const a = await demo()
  await onboard(a)
  await logHistory(a, Array(8).fill(60000))
  expect((await a.get('/api/penyata')).body).toEqual({ weeksLogged: 8, unlockAt: 12, unlocked: false, summary: null })
  const r = await a.get('/api/penyata.pdf')
  expect(r.status).toBe(403)
  expect(r.body.error.message_en).toContain('8/12')
  expect((await a.post('/api/officer-links').send({ months: 3 })).status).toBe(403)
})

test('the Penyata PDF and summary label every figure', async () => {
  const a = await rider()
  const s = (await a.get('/api/penyata')).body.summary
  expect(s.weeks).toBe(12)
  expect(s.source).toBe('self')
  expect(s.monthly.every((m: { source: string }) => m.source === 'self')).toBe(true)
  expect(s.minSen).toBe(40000)
  expect(s.maxSen).toBe(95000)
  const r = await a.get('/api/penyata.pdf?months=3&lang=en').buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = []
    res.on('data', (c: Buffer) => chunks.push(c))
    res.on('end', () => cb(null, Buffer.concat(chunks)))
  })
  expect(r.status).toBe(200)
  expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-')
  expect((await a.get('/api/penyata.pdf?months=4')).status).toBe(422)
})

test('an officer link opens without login and others cannot revoke it', async () => {
  const a = await rider()
  const made = (await a.post('/api/officer-links').send({ months: 6 })).body
  expect(made.path).toMatch(/^\/o\/[\w-]{22}$/)
  const page = await agent().get(made.path) // an officer, not signed in
  expect(page.status).toBe(200)
  expect(page.text).toContain('Penyata Pendapatan')
  expect(page.text).toContain('bukan skor kredit')
  expect(page.text).toContain('Dilapor sendiri')
  expect(page.headers['x-robots-tag']).toMatch(/^noindex/)
  const b = await demo()
  expect((await b.delete(`/api/officer-links/${made.link.id}`)).status).toBe(404)
  expect((await agent().get('/o/not-a-real-token')).status).toBe(404)
})

test('a revoked link is 410', async () => {
  const a = await rider()
  const made = (await a.post('/api/officer-links').send({ months: 3 })).body
  await a.delete(`/api/officer-links/${made.link.id}`)
  expect((await agent().get(made.path)).status).toBe(410)
  expect((await a.get('/api/officer-links')).body.links[0].revoked).toBe(true)
})

test('the payslip shows the week and the payday after it', async () => {
  const a = await rider()
  const p = (await a.get(`/api/payslip/${addWeeks(THIS_WEEK, -1)}`)).body
  expect(p.netSen).toBe(58000)
  expect(p.platforms[0].platform).toBe('grab')
  expect(p.salarySen).toBeGreaterThan(0)
  expect(p.transfer).not.toBeNull()
})
