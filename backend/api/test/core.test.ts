import { expect, test } from 'vitest'
import { addDays, addWeeks } from '../src/lib/weeks.ts'
import { allocate } from '../src/services/pots.ts'
import { demo, logHistory, NETS, onboard, rider, THIS_WEEK } from './helpers.ts'

const potsOf = async (a: Awaited<ReturnType<typeof demo>>) => Object.fromEntries((await a.get('/api/pots')).body.pots.map((p: { kind: string }) => [p.kind, p]))

test('onboarding saves the profile and consent', async () => {
  const a = await demo()
  const user = await onboard(a)
  expect(user.onboarded).toBe(true)
  expect(user.platforms).toEqual(['grab', 'foodpanda'])
  expect(user.essentialsWeekSen).toBe(45000)
  const res = await a.post('/api/consents').send({ kind: 'privacy', version: '2026-10', granted: true })
  expect(res.body.user.consents.privacy).toEqual({ granted: true, version: '2026-10' })
  expect((await a.get('/api/auth/me')).body.user.onboarded).toBe(true)
})

test('home is empty before any week', async () => {
  const a = await demo()
  await onboard(a)
  const home = (await a.get('/api/home')).body
  expect(home.salary).toBeNull()
  expect(home.needsSnap).toBe(true)
  expect(home.weeksLogged).toBe(0)
})

test('confirming weeks gives a salary and a transfer', async () => {
  const a = await rider()
  const home = (await a.get('/api/home')).body
  const s = home.salary
  expect(s.weekStart).toBe(THIS_WEEK)
  expect(s.salarySen).toBeGreaterThan(0)
  expect(s.salarySen % 100).toBe(0)
  expect(s.risk).toBe('selamat')
  expect(s.buildUp.targetSen).toBe(90000) // no buffer yet: 2 weeks of essentials
  expect(home.needsSnap).toBe(false)
  const t = home.transfer
  const signed = t.direction === 'in' ? t.amountSen : -t.amountSen
  expect(signed).toBe(NETS.at(-1)! - s.salarySen - s.billsThisWeekSen)
})

test('Dah pindah moves the buffer, and a partial is tracked without double counting', async () => {
  const a = await rider(Array(6).fill(90000))
  const t = (await a.get('/api/home')).body.transfer
  expect(t.direction).toBe('in')
  expect(t.status).toBe('pending')
  const half = Math.floor(t.amountSen / 2)
  expect((await a.post(`/api/transfers/${t.id}/confirm`).send({ amountSen: half })).body.transfer.status).toBe('partial')
  const sick = t.allocation.cuti // the sick-day reserve is filled first
  let pots = await potsOf(a)
  expect(pots.cuti.balanceSen).toBe(sick)
  expect(pots.penampan.balanceSen).toBe(half - sick)
  await a.post(`/api/transfers/${t.id}/confirm`).send({})
  pots = await potsOf(a)
  expect(pots.cuti.balanceSen).toBe(sick)
  expect(pots.penampan.balanceSen).toBe(t.amountSen - sick)
})

test('a bill lowers the salary', async () => {
  const a = await rider()
  const before = (await a.get('/api/home')).body.salary.salarySen
  const due = Number(addDays(THIS_WEEK, 9).slice(8, 10))
  expect((await a.post('/api/bills').send({ name: 'Ansuran motor', amountSen: 28000, frequency: 'monthly', dueDay: due })).status).toBe(201)
  const after = (await a.get('/api/home')).body.salary
  expect(after.salarySen).toBeLessThan(before)
  expect(after.factors[0]).toMatchObject({ key: 'first' }) // same week re-run: nothing earlier to compare with
})

test('bad input is refused', async () => {
  const a = await demo()
  const week = (weekStart: string, grossSen: number) => ({ weeks: [{ weekStart, platforms: [{ platform: 'grab', grossSen }] }] })
  expect((await a.post('/api/weeks/confirm').send(week(addDays(THIS_WEEK, 1), 100))).status).toBe(422) // not a Monday
  expect((await a.post('/api/weeks/confirm').send(week(addWeeks(THIS_WEEK, 1), 100))).status).toBe(422) // the future
  expect((await a.post('/api/weeks/confirm').send(week(THIS_WEEK, -5))).status).toBe(422)
  expect((await a.post('/api/bills').send({ name: 'x', amountSen: 100, frequency: 'monthly' })).status).toBe(422)
  expect((await a.post('/api/weeks/confirm').send({ weeks: [], extra: 1 })).status).toBe(422)
})

test("another rider's data is 404", async () => {
  const a = await rider()
  const tId = (await a.get('/api/home')).body.transfer.id
  const billId = (await a.post('/api/bills').send({ name: 'Telefon', amountSen: 5000, frequency: 'monthly', dueDay: 5 })).body.bill.id
  const earningId = (await a.get('/api/weeks')).body.weeks[0].platforms[0].id
  const b = await demo() // a different rider
  expect((await b.post(`/api/transfers/${tId}/confirm`).send({})).status).toBe(404)
  expect((await b.delete(`/api/bills/${billId}`)).status).toBe(404)
  expect((await b.delete(`/api/earnings/${earningId}`)).status).toBe(404)
  expect((await b.get('/api/weeks')).body.weeks).toEqual([])
})

test('allocation fills plans first and always adds up', () => {
  const alloc = { cuti: 10000, isaraan: 5000, penampan: 20000 }
  expect(allocate(alloc, 35000, 35000)).toEqual(alloc)
  expect(allocate(alloc, 35000, 12000)).toEqual({ cuti: 10000, isaraan: 2000 })
  expect(allocate(alloc, 35000, 50000)).toEqual({ cuti: 10000, isaraan: 5000, penampan: 35000 })
  const out = allocate({ cuti: -30000, penampan: -10000 }, -40000, -20000)
  expect(out).toEqual({ cuti: -15000, penampan: -5000 })
})

test('Jurang options are simulated', async () => {
  const a = await demo()
  await onboard(a)
  await a.patch('/api/me').send({ essentialsWeekSen: 80000, defaultHours: 35 })
  await logHistory(a, Array(10).fill(50000))
  const j = (await a.get('/api/jurang')).body
  expect(j.active).toBe(true)
  expect(j.gapSen).toBe(80000 - j.salarySen)
  expect(j.hours.hours).toBeGreaterThan(j.hours.plannedHours)
  expect(j.hours.fatigue).toBe(j.hours.hours > 60)
  expect(j.entitlements.isaraanMatchRate).toBe(0.2)
  const b = await rider(Array(10).fill(90000))
  expect((await b.get('/api/jurang')).body).toEqual({ active: false })
})
