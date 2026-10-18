import { expect, test } from 'vitest'
import { demo, fakeLlm } from './helpers.ts'

test('BM cost phrases parse in the ML service without the LLM', async () => {
  const a = await demo()
  expect((await a.post('/api/expenses/parse').send({ text: 'isi minyak empat puluh' })).body).toEqual({ amountSen: 4000, category: 'minyak', tier: 'rules', confidence: 1 })
  const x = (await a.post('/api/expenses').send({ amountSen: 4000, category: 'minyak', parseTier: 'rules' })).body.expense
  expect((await a.get('/api/expenses')).body.expenses[0].id).toBe(x.id)
  expect((await a.delete(`/api/expenses/${x.id}`)).status).toBe(204)
})

test('the LLM only fills what tiers 1–2 could not, and never overrides a parsed number', async () => {
  const a = await demo()
  const llm = fakeLlm()
  llm.reply = '{"category": "lain", "amount_rm": 99999}'
  const r = (await a.post('/api/expenses/parse').send({ text: 'zxqv plugh 40' })).body
  expect(r).toMatchObject({ tier: 'llm', category: 'lain', amountSen: 4000 })
  expect(String((llm.requests[0]!.messages as { content: string }[])[1]!.content)).toBe('<note>zxqv plugh 40</note>')
})

test('another rider cannot delete my costs', async () => {
  const a = await demo()
  const x = (await a.post('/api/expenses').send({ amountSen: 500, category: 'makan' })).body.expense
  const b = await demo()
  expect((await b.delete(`/api/expenses/${x.id}`)).status).toBe(404)
})
