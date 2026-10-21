// Tanya's reply in progress, kept outside the screen: leave Tanya mid-answer and it keeps arriving, so it is
// there when you come back. The server saves the answer either way.
import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { ApiError, type Message } from './api'

// pending: the message being answered. failed: the last one that didn't get an answer, for "Try again".
type State = { pending: string | null; text: string; error: unknown; failed: string | null }
let state: State = { pending: null, text: '', error: null, failed: null }
const listeners = new Set<() => void>()
const set = (next: Partial<State>) => {
  state = { ...state, ...next }
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useTanyaChat = () => useSyncExternalStore(subscribe, () => state)
export const clearTanyaError = () => set({ error: null, failed: null })

const toError = (e: { code?: string; message_ms?: string; message_en?: string } | undefined, status = 0) =>
  new ApiError(status, e?.code ?? 'network', e?.message_ms ?? 'Tak dapat sambung. Cuba lagi.', e?.message_en ?? "Couldn't connect. Try again.")

/** Send a message and read the reply as it streams in (one JSON event per line). */
export async function sendTanya(message: string, queryClient: QueryClient) {
  if (state.pending) return
  set({ pending: message, text: '', error: null, failed: null })
  try {
    const res = await fetch('/api/tanya/messages?stream=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) })
    if (!res.ok || !res.body) throw toError((await res.json().catch(() => null))?.error, res.status)
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    let answered = false
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop()!
      for (const line of lines.filter(Boolean)) {
        const e = JSON.parse(line)
        if (e.type === 'text') set({ text: state.text + e.text })
        else if (e.type === 'reset') set({ text: '' })
        else if (e.type === 'error') throw toError(e.error, 502)
        else if (e.type === 'done') {
          // Show the saved answer straight away, then let the list refresh from the server
          queryClient.setQueryData<Message[]>(['messages'], (old) => [
            ...(old ?? []),
            { role: 'user', content: message, risk: null, at: e.at },
            { role: 'assistant', content: e.reply, risk: e.risk, at: e.at },
          ])
          set({ pending: null, text: '' })
          answered = true
        }
      }
    }
    if (!answered) throw toError(undefined) // the line dropped mid-answer (e.g. the server restarted)
    void queryClient.invalidateQueries({ queryKey: ['messages'] })
  } catch (err) {
    set({ pending: null, text: '', error: err instanceof ApiError ? err : toError(undefined), failed: message })
    void queryClient.invalidateQueries({ queryKey: ['messages'] }) // it may have been saved before the line dropped
  }
}
