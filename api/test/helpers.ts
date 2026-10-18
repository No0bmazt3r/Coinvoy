import OpenAI from 'openai'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { addWeeks, thisWeek } from '../src/lib/weeks.ts'
import { provider } from '../src/llm/client.ts'
import { env } from '../src/env.ts'

export const app = createApp()
export const THIS_WEEK = thisWeek()
export const NETS = [62000, 48000, 91000, 55000, 40000, 73000, 95000, 52000, 61000, 44000, 80000, 58000]

/** A cookie-keeping client, like a browser. */
export const agent = () => request.agent(app)
export type Agent = ReturnType<typeof agent>

/** A demo rider with no data (the real demo seeds Faiz). */
export async function demo(a: Agent = agent(), seeded = false) {
  const res = await a.post(seeded ? '/api/auth/demo' : '/api/auth/demo?empty')
  if (res.status !== 204) throw new Error(`demo ${res.status} ${res.text}`)
  return a
}

export async function onboard(a: Agent) {
  const res = await a.patch('/api/me').send({ platforms: ['grab', 'foodpanda'], city: 'Ipoh', defaultHours: 45, essentialsWeekSen: 45000, paydayWeekday: 0, onboarded: true })
  if (res.status !== 200) throw new Error(res.text)
  return res.body.user
}

export async function logHistory(a: Agent, nets = NETS) {
  const weeks = nets.map((n, i) => ({ weekStart: addWeeks(THIS_WEEK, i - nets.length), platforms: [{ platform: 'grab', grossSen: n, hoursOnline: 45, source: 'history' }] }))
  const res = await a.post('/api/weeks/confirm').send({ weeks })
  if (res.status !== 200) throw new Error(res.text)
}

export async function rider(nets = NETS) {
  const a = await demo()
  await onboard(a)
  await logHistory(a, nets)
  return a
}

/** A fake OpenAI-compatible provider. Queue replies (string = content, object = a full message). */
export function fakeLlm() {
  const state = { replies: [] as (string | Record<string, unknown>)[], reply: '{}' as string | Record<string, unknown>, rejectSchema: false, requests: [] as Record<string, unknown>[] }
  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    state.requests.push(body)
    if (state.rejectSchema && body.response_format) return new Response(JSON.stringify({ error: { message: 'response_format not supported' } }), { status: 400 })
    const reply = state.replies.length ? state.replies.shift()! : state.reply
    const message = typeof reply === 'string' ? { role: 'assistant', content: reply } : reply
    return new Response(
      JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model: 'm', choices: [{ index: 0, finish_reason: 'stop', message }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  provider.client = new OpenAI({ baseURL: 'http://fake/v1', apiKey: 'k', maxRetries: 0, fetch })
  Object.assign(env, { LLM_API_KEY: 'k', LLM_MODEL: 'shared-model', LLM_MODEL_SNAP: 'vision-model' })
  return state
}

export function noLlm() {
  provider.client = null
  Object.assign(env, { LLM_API_KEY: '', LLM_MODEL: '', LLM_MODEL_SNAP: '' })
}
