import { expect, test } from 'vitest'
import { allowedValues, check, extract } from '../src/llm/guard.ts'
import { checkOffer, fcaMatch, instalment } from '../src/services/advisor.ts'
import { demo, fakeLlm, rider } from './helpers.ts'

// The number guard
const TOOL = '{"salary_sen": 61740, "salary_rm": 617.4, "p_safe": 0.953, "risk": "selamat", "buffer_rm": 1250}'

test('guard: a made-up amount is blocked, rounded tool numbers pass', () => {
  const allowed = allowedValues(TOOL)
  expect(check('Gaji anda RM650 minggu ini.', allowed)).toEqual([650])
  expect(check('Selamat. Gaji anda RM617 minggu ini, 95% selamat.', allowed)).toEqual([])
  expect(check('Gaji anda RM617.40.', allowed)).toEqual([])
  expect(check('Penampan anda RM1,250.', allowed)).toEqual([])
})

test('guard: BM percent and number words normalise; the rider’s own numbers pass', () => {
  expect(check('Kira-kira 95 peratus selamat.', allowedValues(TOOL))).toEqual([])
  expect(check('Anda boleh belanja empat puluh ringgit.', allowedValues(TOOL))).toEqual([40])
  expect(check('Anda boleh belanja empat puluh ringgit.', allowedValues(TOOL, 'kalau saya beli 40 ringgit'))).toEqual([])
  expect(check('Telefon RM1,200 itu berisiko untuk anda.', allowedValues(TOOL, 'Boleh tak saya beli telefon RM1.2k?'))).toEqual([])
})

test('guard: small counts with units are structure; small money is still money', () => {
  expect(check('Ini 3 pilihan untuk anda dalam 2 minggu.', allowedValues(TOOL))).toEqual([])
  expect(check('Simpan 3 ringgit.', allowedValues(TOOL))).toEqual([3])
  expect(extract('RM1.5k, 12.50, 1,234 dan dua ratus lima puluh').map((f) => f.value)).toEqual([1500, 12.5, 1234, 250])
})

// Tanya
const toolCall = (name: string, args: Record<string, unknown> = {}) => ({ role: 'assistant', content: '', tool_calls: [{ id: `c-${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })

test('Tanya calls the engine, and a reply quoting tool numbers passes the guard', async () => {
  const a = await rider()
  const salary = (await a.get('/api/home')).body.salary.salarySen / 100
  const llm = fakeLlm()
  llm.replies = [toolCall('get_salary'), `Selamat. Gaji anda RM${Math.round(salary)} minggu ini.`]
  const r = (await a.post('/api/tanya/messages').send({ message: 'Berapa gaji saya?' })).body
  expect(r.reply).toBe(`Selamat. Gaji anda RM${Math.round(salary)} minggu ini.`)
  expect(r.risk).toBe('selamat')
  expect(r.guardTriggered).toBe(false)
  const toolMsg = (llm.requests[1]!.messages as { role: string; content: string }[]).find((m) => m.role === 'tool')!
  expect(JSON.parse(toolMsg.content).salary_rm).toBe(salary)
  const history = (await a.get('/api/tanya/messages')).body.messages
  expect(history.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant'])
})

test('Tanya: a made-up number is retried once, then replaced by a reply built from the tools', async () => {
  const a = await rider()
  const llm = fakeLlm()
  llm.replies = [toolCall('simulate', { add_monthly_instalment_rm: 300 }), 'Selamat! Anda boleh simpan RM9999.', 'Masih RM8888.']
  const r = (await a.post('/api/tanya/messages').send({ message: 'Boleh ambil ansuran RM300 sebulan?' })).body
  expect(r.guardTriggered).toBe(true)
  expect(r.reply).not.toMatch(/9999|8888/)
  expect(r.reply).toMatch(/^(Selamat|Berhati-hati|Berisiko)\./)
  expect(llm.requests).toHaveLength(3)
})

test('Tanya: a fixed reply after the retry passes', async () => {
  const a = await rider()
  const llm = fakeLlm()
  llm.replies = [toolCall('get_forecast'), 'Biasanya RM12345.', 'Saya tak pasti angka tepat. Cuba tanya gaji anda.']
  const r = (await a.post('/api/tanya/messages').send({ message: 'Minggu depan dapat berapa?' })).body
  expect(r.guardTriggered).toBe(true)
  expect(r.reply).toBe('Saya tak pasti angka tepat. Cuba tanya gaji anda.')
})

test('Tanya can point a scam victim to 997 without the guard blocking it', async () => {
  const a = await rider()
  const llm = fakeLlm()
  llm.replies = ['Jangan kongsi kod TAC. Jika duit sudah hilang, telefon 997 segera dan semak mesej di Semak Mesej.']
  const r = (await a.post('/api/tanya/messages').send({ message: 'Ada orang minta kod TAC saya' })).body
  expect(r.guardTriggered).toBe(false)
  expect(r.reply).toContain('997')
})

test('Tanya tools only see the signed-in rider', async () => {
  const a = await rider()
  const b = await demo() // no data
  const llm = fakeLlm()
  llm.replies = [toolCall('get_salary'), 'Anda belum snap pendapatan.']
  await b.post('/api/tanya/messages').send({ message: 'Gaji saya?' })
  const toolMsg = (llm.requests[1]!.messages as { role: string; content: string }[]).find((m) => m.role === 'tool')!
  expect(JSON.parse(toolMsg.content)).toEqual({ error: 'no_earnings_logged_yet' })
  expect((await a.get('/api/tanya/messages')).body.messages).toEqual([])
})

test('Tanya needs a key', async () => {
  const a = await rider()
  const r = await a.post('/api/tanya/messages').send({ message: 'hai' })
  expect(r.status).toBe(503)
})

// Semak Layak
test('flat vs effective rate', () => {
  const loan = instalment(600_000, 0, 24, 10) // RM6,000 phone, 24 months, 10% flat
  expect(loan.interestSen).toBe(120_000)
  expect(loan.monthlySen).toBe(30_000)
  expect(loan.effectivePctYear).toBeGreaterThan(17)
  expect(loan.effectivePctYear).toBeLessThan(19)
})

test('Semak Layak simulates the instalment on the rider’s own weeks', async () => {
  const a = await rider()
  const r = (await a.post('/api/layak').send({ item: 'Telefon', priceSen: 300_000, months: 12, flatRatePct: 8 })).body
  expect(r.monthlySen).toBe(27_000)
  expect(r.newSalarySen).toBeLessThan(r.salarySen)
  expect(['selamat', 'berhati', 'berisiko']).toContain(r.risk)
  const big = (await a.post('/api/layak').send({ item: 'Motor baru', priceSen: 1_500_000, months: 12, flatRatePct: 10 })).body
  expect(big.risk).toBe('berisiko') // a risky result is shown, not hidden
})

// Lender check
test('the lender check flags an Ah Long offer with rules alone', () => {
  const r = checkOffer('Pinjaman cepat RM5000! Lulus segera, blacklist pun boleh. Bayar dulu yuran proses RM200. Faedah 10% sebulan. WhatsApp 012-3456789', null)
  expect(r.level).toBe('tinggi')
  expect(r.flags).toEqual(expect.arrayContaining(['upfront_fee', 'no_ctos_claim', 'whatsapp_only', 'instant', 'rate_over_cap']))
  expect(r.rate).toMatchObject({ pct: 10, period: 'month', yearlyPct: 120, overCap: true })
  expect(r.fca.listDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('the BNM alert list matches exact names only, never a vague similarity', () => {
  expect(fcaMatch('FalconRise Capital', '').matched).toBe(true)
  expect(fcaMatch('falconrise capital sdn bhd', '').matched).toBe(true)
  expect(fcaMatch('Falcon Capital', '').matched).toBe(false)
  expect(fcaMatch(null, 'https://www.instagram.com/p/DW8ZRVcjJ4g').matched).toBe(true)
  expect(fcaMatch(null, 'https://www.instagram.com/p/someone-else').matched).toBe(false)
})

test('the lender check endpoint works without AI, and uses the AI name when there is one', async () => {
  const a = await rider()
  let r = (await a.post('/api/lender-check').send({ text: 'Koperasi kami tawar pinjaman 4% setahun, permohonan di cawangan.' })).body
  expect(r.level).toBe('rendah')
  expect(r.usedAi).toBe(false)
  const llm = fakeLlm()
  llm.reply = JSON.stringify({ lender_name: 'FalconRise Capital', phone: null, stated_rate_pct: null, rate_period: null, upfront_fee: false, no_ctos_claim: false, whatsapp_only: false, red_flags: [] })
  r = (await a.post('/api/lender-check').send({ text: 'FalconRise Capital: pelaburan dan pinjaman mudah, hubungi kami.' })).body
  expect(r.fca.matched).toBe(true)
  expect(r.level).toBe('tinggi')
  expect(r.usedAi).toBe(true)
})

test('Celik lessons are triggered by the rider’s data', async () => {
  const a = await rider()
  const lessons = (await a.get('/api/celik')).body.lessons
  const topics = lessons.map((l: { topic: string }) => l.topic)
  expect(topics).toEqual(expect.arrayContaining(['buffer', 'isaraan', 'leave', 'perkeso']))
  expect(lessons.find((l: { topic: string }) => l.topic === 'buffer').text).toContain('RM900')
})
