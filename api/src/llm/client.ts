// One LLM client for every provider that speaks the OpenAI chat API. OpenRouter, Gemini, OpenAI, Anthropic,
// Groq and Ollama all do, so switching provider is LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env, never code.
import OpenAI from 'openai'
import type { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { z } from 'zod'
import { env } from '../env.ts'
import { ApiError } from '../errors.ts'
import { log } from '../log.ts'

export type Route = 'snap' | 'tanya' | 'lender' | 'bm' | 'reco'

// Tests swap in a client pointed at a fake provider (used for every route).
export const provider: { client: OpenAI | null } = { client: null }
const clients = new Map<string, OpenAI>()

/**
 * Which key and address each AI job uses.
 * LLM_SPLIT_KEYS=false: every job uses the shared key.
 * LLM_SPLIT_KEYS=true: each job uses its own key, and a job without one is switched off.
 */
export function keyFor(route: Route): { apiKey: string; baseURL: string } {
  const [key, url] = {
    snap: [env.LLM_API_KEY_SNAP, env.LLM_BASE_URL_SNAP],
    tanya: [env.LLM_API_KEY_TANYA, env.LLM_BASE_URL_TANYA],
    lender: [env.LLM_API_KEY_TANYA, env.LLM_BASE_URL_TANYA],
    reco: [env.LLM_API_KEY_RECO, env.LLM_BASE_URL_RECO],
    bm: [env.LLM_API_KEY_RECO, env.LLM_BASE_URL_RECO],
  }[route]
  if (!env.LLM_SPLIT_KEYS) return { apiKey: env.LLM_API_KEY, baseURL: env.LLM_BASE_URL }
  return { apiKey: key ?? '', baseURL: url || env.LLM_BASE_URL }
}

/** One line per job for the startup log: mode, the key's last 4 characters (never the key), host and model. */
export function describeAi(): string[] {
  const jobs: [string, Route][] = [['ocr (snap)', 'snap'], ['chatbot (tanya)', 'tanya'], ['chatbot (lender)', 'lender'], ['recommendations (reco)', 'reco'], ['recommendations (bm)', 'bm']]
  return jobs.map(([name, route]) => {
    const { apiKey, baseURL } = keyFor(route)
    const where = apiKey ? `key …${apiKey.slice(-4)} @ ${new URL(baseURL).host}` : 'no key: off'
    return `${name}: ${env.LLM_SPLIT_KEYS ? 'split' : 'merge'} · ${where} · model ${modelFor(route) || '(none: off)'}`
  })
}

export const routeConfigured = (route: Route) => Boolean(provider.client || (keyFor(route).apiKey && modelFor(route)))

function client(route: Route): OpenAI {
  if (provider.client) return provider.client
  if (!routeConfigured(route)) throw new ApiError(503, 'llm_unconfigured', 'Ciri AI belum disediakan. Sila isi secara manual.', "AI features aren't set up. Please enter it manually.")
  const { apiKey, baseURL } = keyFor(route)
  const id = `${baseURL} ${apiKey}`
  if (!clients.has(id)) clients.set(id, new OpenAI({ baseURL, apiKey, timeout: env.LLM_TIMEOUT_S * 1000, maxRetries: 2 }))
  return clients.get(id)!
}

/** Per-route override (LLM_MODEL_SNAP, …) or the shared LLM_MODEL. */
export function modelFor(route: Route): string {
  const perRoute = { snap: env.LLM_MODEL_SNAP, tanya: env.LLM_MODEL_TANYA, lender: env.LLM_MODEL_LENDER, bm: env.LLM_MODEL_BM, reco: env.LLM_MODEL_RECO }[route]
  return perRoute || env.LLM_MODEL
}

/** An image as a message part. Every OpenAI-compatible provider accepts data URLs. */
export const imagePart = (data: Buffer, mime = 'image/jpeg') => ({ type: 'image_url' as const, image_url: { url: `data:${mime};base64,${data.toString('base64')}` } })

export type ChatResult<T> = { message: ChatCompletionMessage; parsed: T; model: string; inputTokens: number; outputTokens: number }

export async function chat<T = undefined>(
  route: Route,
  messages: ChatCompletionMessageParam[],
  opts: { schema?: z.ZodType<T>; tools?: ChatCompletionTool[]; maxTokens?: number } = {},
): Promise<ChatResult<T>> {
  const model = modelFor(route)
  const body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = { model, messages, max_tokens: opts.maxTokens ?? 1024 }
  if (opts.tools) body.tools = opts.tools
  if (opts.schema) body.response_format = { type: 'json_schema', json_schema: { name: route, schema: z.toJSONSchema(opts.schema) as Record<string, unknown>, strict: false } }
  let res: OpenAI.Chat.ChatCompletion
  try {
    try {
      res = await client(route).chat.completions.create(body)
    } catch (err) {
      if (!(err instanceof OpenAI.BadRequestError) || !opts.schema) throw err
      // Some providers reject json_schema; the prompt asks for JSON and zod still validates.
      delete body.response_format
      res = await client(route).chat.completions.create(body)
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    log('error', 'llm failed', { route, err: err instanceof Error ? err.message : String(err) })
    throw new ApiError(502, 'llm_failed', 'AI tidak dapat dihubungi. Cuba lagi atau isi secara manual.', "The AI couldn't be reached. Try again or enter it manually.")
  }
  const message = res.choices[0]!.message
  const parsed = (opts.schema ? parseJson(message.content ?? '', opts.schema) : undefined) as T
  return { message, parsed, model, inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0 }
}

function parseJson<T>(text: string, schema: z.ZodType<T>): T {
  // Models without native JSON mode often wrap it in ``` fences or add a sentence around it.
  const match = text.match(/\{[\s\S]*\}/)
  try {
    return schema.parse(JSON.parse(match ? match[0] : text))
  } catch {
    throw new ApiError(502, 'llm_bad_output', 'AI memberi jawapan yang tidak sah. Sila isi secara manual.', 'The AI gave an invalid answer. Please enter it manually.')
  }
}
