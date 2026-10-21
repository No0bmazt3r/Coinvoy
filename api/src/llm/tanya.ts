// Tanya: a small tool loop over the engine, with the number guard on every reply.
// Tools are read-only and scoped to the signed-in rider. The model talks; the engine computes.
import { readFileSync } from 'node:fs'
import { and, eq } from 'drizzle-orm'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { User } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { addWeeks } from '../lib/weeks.ts'
import { ml, type Risk, type Scenario } from '../ml.ts'
import { lesson } from '../services/lessons.ts'
import { ensurePots } from '../services/pots.ts'
import { runScenario } from '../services/salary.ts'
import { type ChatResult, chat } from './client.ts'
import { allowedValues, check } from './guard.ts'

const PROMPT = readFileSync(new URL('./prompts/tanya.md', import.meta.url), 'utf8')

// How Tanya talks, by the language set in Profil: casual Manglish in English, casual spoken Malay in BM.
const VOICE = {
  en: `- Reply in casual Malaysian English (Manglish), the way riders text each other: short sentences, a particle like "lah", "lor", "ah", "can", "ok what" here and there (one or two per reply, not every sentence), and common Malay words riders use anyway: gaji, duit, tabung, bil, cuti, minggu ni.
- Call the rider "you". Never switch to formal English or to full Malay unless the rider writes in Malay.
- Example: "Safe. Your gaji this week can cover it lah. Just don't spend the whole thing at once ah, keep some for your bil."`,
  ms: `- Balas dalam Bahasa Melayu santai, macam mesej dengan kawan: ayat pendek, guna "tak", "nak", "dah", "je", "kan", "tau", "sikit", "boleh". Jangan guna bahasa buku atau ayat rasmi.
- Panggil rider "awak". Perkataan Inggeris yang biasa rider guna (top-up, servis, apps) boleh dikekalkan.
- Contoh: "Selamat. Gaji minggu ni cukup untuk tu. Cuma jangan habiskan sekali gus tau, simpan sikit untuk bil."`,
}
const MAX_TOOL_ROUNDS = 4
const SCAM_HOTLINE = '997' // NSRC, the National Scam Response Centre (prompts/tanya.md)
const RISK: Record<'ms' | 'en', Record<Risk, string>> = {
  ms: { selamat: 'Selamat', berhati: 'Berhati-hati', berisiko: 'Berisiko' },
  en: { selamat: 'Safe', berhati: 'Careful', berisiko: 'Risky' },
}

const fn = (name: string, description: string, properties: Record<string, unknown> = {}): ChatCompletionTool => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, additionalProperties: false } },
})

export const TOOLS: ChatCompletionTool[] = [
  fn('get_salary', "This week's safe salary, its risk word and safety %, the buffer, and the gap if any."),
  fn('get_forecast', "The rider's usual weekly earnings: a slow week, a usual week and a busy week, and planned hours."),
  fn('simulate', "What-if: the new safe salary and how safe the current salary stays if something changes. Use it for 'can I afford', new instalments, one-off purchases, more or fewer hours, or leave.", {
    hours_per_week: { type: 'number', minimum: 0, maximum: 84 },
    add_monthly_instalment_rm: { type: 'number', minimum: 0, maximum: 100000 },
    one_off_expense_rm: { type: 'number', minimum: 0, maximum: 100000 },
    one_off_in_weeks: { type: 'integer', minimum: 0, maximum: 11 },
    leave_in_weeks: { type: 'integer', minimum: 1, maximum: 11 },
    leave_weeks: { type: 'integer', minimum: 1, maximum: 4 },
  }),
  fn('get_pots', "The rider's pots (Penampan, Cuti, Kecemasan, Motor, Raya, i-Saraan) with balances and targets."),
  fn('get_bills', "The rider's bills with amounts and how often they are due."),
  fn('explain', "A short lesson using the rider's own numbers.", {
    topic: { type: 'string', enum: ['commission', 'buffer', 'flat_vs_effective', 'perkeso', 'isaraan', 'leave'] },
  }),
]

const rm = (sen: number) => Math.round(sen) / 100
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/** Every tool reads only this rider's data. Money comes back in ringgit (_rm) for the model to quote. */
export async function runTool(user: User, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (name === 'get_salary' || name === 'get_forecast' || name === 'simulate') {
    const base = await runScenario(db, user)
    if (!base) return { error: 'no_earnings_logged_yet' }
    const { inputs, result: now } = base
    if (name === 'get_salary') {
      return { salary_rm: rm(now.salarySen), safe_percent: Math.round(now.pSafe * 100), risk: now.risk, buffer_rm: rm(inputs.bufferSen), essentials_rm: rm(inputs.essentialsWeekSen), gap_rm: rm(now.jurang?.gapSen ?? 0) }
    }
    if (name === 'get_forecast') return { slow_week_rm: rm(now.band.low), usual_week_rm: rm(now.band.mid), busy_week_rm: rm(now.band.high), planned_hours: now.plannedHours }
    const scenario: Scenario = {
      hours: typeof args.hours_per_week === 'number' ? args.hours_per_week : null,
      addMonthlySen: Math.round(num(args.add_monthly_instalment_rm) * 100),
      oneOffSen: Math.round(num(args.one_off_expense_rm) * 100),
      oneOffWeek: num(args.one_off_in_weeks, 1),
      leaves: args.leave_in_weeks ? [{ startWeek: addWeeks(inputs.weekStart, num(args.leave_in_weeks, 1)), weeks: num(args.leave_weeks, 1), setAsideWeekSen: 0 }] : [],
    }
    const [next, safety] = await Promise.all([ml.solve(inputs, scenario), ml.pSafe(inputs, now.salarySen, scenario)])
    return {
      current_salary_rm: rm(now.salarySen),
      current_salary_safe_percent_after: Math.round(safety.pSafe * 100),
      risk: safety.risk,
      new_safe_salary_rm: rm(next.salarySen),
      salary_change_rm: rm(next.salarySen - now.salarySen),
    }
  }
  if (name === 'get_pots') {
    return { pots: Object.values(await ensurePots(db, user.id)).filter((p) => p.active || p.balanceSen).map((p) => ({ pot: p.name ?? p.kind, balance_rm: rm(p.balanceSen), target_rm: rm(p.targetSen), weekly_rm: rm(p.weeklySen) })) }
  }
  if (name === 'get_bills') {
    const rows = await db.select().from(schema.bills).where(and(eq(schema.bills.userId, user.id), eq(schema.bills.active, true)))
    return { bills: rows.map((b) => ({ name: b.name, amount_rm: rm(b.amountSen), frequency: b.frequency })) }
  }
  if (name === 'explain') return lesson(db, user, String(args.topic ?? 'buffer'), user.lang)
  return { error: 'unknown_tool' }
}

/** Built only from tool results, so it can't contain a made-up number. */
export function fallback(results: Record<string, unknown>[], lang: 'ms' | 'en'): string {
  const sim = results.find((r) => 'new_safe_salary_rm' in r) as Record<string, number> & { risk: Risk } | undefined
  const sal = results.find((r) => 'salary_rm' in r) as Record<string, number> & { risk: Risk } | undefined
  if (sim) {
    const w = RISK[lang][sim.risk]
    return lang === 'ms'
      ? `${w}. Gaji anda kekal ${sim.current_salary_safe_percent_after}% selamat dengan perubahan ini. Gaji selamat baharu: RM${Math.round(sim.new_safe_salary_rm!)}.`
      : `${w}. Your salary stays ${sim.current_salary_safe_percent_after}% safe with this change. New safe salary: RM${Math.round(sim.new_safe_salary_rm!)}.`
  }
  if (sal) {
    const w = RISK[lang][sal.risk]
    return lang === 'ms' ? `${w}. Gaji anda minggu ini RM${Math.round(sal.salary_rm!)}, ${sal.safe_percent}% selamat.` : `${w}. Your salary this week is RM${Math.round(sal.salary_rm!)}, ${sal.safe_percent}% safe.`
  }
  return lang === 'ms' ? 'Maaf, saya tak dapat jawab dengan tepat. Cuba tanya tentang gaji, tabung, bil atau cuti anda.' : "Sorry, I can't answer that precisely. Try asking about your salary, pots, bills or leave."
}

export type TanyaAnswer = { reply: string; risk: Risk | null; tools: string[]; guardTriggered: boolean }

export async function answer(user: User, history: ChatCompletionMessageParam[], message: string, onCall: (r: ChatResult<undefined>) => Promise<void>): Promise<TanyaAnswer> {
  const lang = user.lang === 'en' ? 'en' : 'ms'
  const system = PROMPT.replace('{voice}', VOICE[lang])
  const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: `<rider_message>${message}</rider_message>` }]
  const results: Record<string, unknown>[] = []
  const tools: string[] = []
  const complete = async (msgs: ChatCompletionMessageParam[]) => {
    const r = await chat('tanya', msgs, { tools: TOOLS, maxTokens: 500 })
    await onCall(r)
    return r
  }

  let reply = ''
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const r = await complete(messages)
    const calls = (r.message.tool_calls ?? []).filter((c) => c.type === 'function')
    if (!calls.length) {
      reply = r.message.content ?? ''
      break
    }
    messages.push({ role: 'assistant', content: r.message.content ?? '', tool_calls: calls })
    for (const c of calls) {
      let args: unknown = {}
      try {
        args = JSON.parse(c.function.arguments || '{}')
      } catch {
        args = {}
      }
      const out = await runTool(user, c.function.name, args && typeof args === 'object' ? (args as Record<string, unknown>) : {})
      results.push(out)
      tools.push(c.function.name)
      messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(out) })
    }
  }

  // Besides tool results and the rider's words, one fixed fact the prompt tells Tanya to give: the scam hotline
  const allowed = allowedValues(message, SCAM_HOTLINE, ...results.map((x) => JSON.stringify(x)))
  const bad = check(reply, allowed)
  if (bad.length) {
    // One retry, naming the numbers that had no source; then the templated answer.
    const note = `Your draft used numbers no tool returned: ${bad.join(', ')}. Rewrite it using only numbers from the tool results above, or call a tool.`
    const retry = await complete([...messages, { role: 'assistant', content: reply }, { role: 'system', content: note }])
    reply = retry.message.content ?? ''
    if (!reply || check(reply, allowed).length || retry.message.tool_calls?.length) reply = fallback(results, lang)
  }
  if (!reply.trim()) reply = fallback(results, lang)
  const risk = ([...results].reverse().find((x) => typeof x.risk === 'string')?.risk ?? null) as Risk | null
  return { reply: reply.trim(), risk, tools, guardTriggered: bad.length > 0 }
}
