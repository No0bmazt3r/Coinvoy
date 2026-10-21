// The payday reminder on this device: the browser asks for permission, the API stores the subscription.
import { api } from './api'

export type PushState = { publicKey: string | null; endpoints: string[] }

/** Needs a service worker (production build) and the Push API; iPhones need the app installed to the home screen. */
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const registration = () => navigator.serviceWorker.getRegistration()

export async function deviceEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null
  return (await (await registration())?.pushManager.getSubscription())?.endpoint ?? null
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const raw = atob(base64url.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function enablePush(publicKey: string): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied')
  const reg = await registration()
  if (!reg) throw new Error('no_worker')
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  await api('/api/push', { body: sub.toJSON() })
}

/** Stops reminders on this device. Also runs on sign-out, so a shared phone stops reminding. */
export async function disablePush(): Promise<void> {
  const sub = pushSupported() ? await (await registration())?.pushManager.getSubscription() : null
  if (!sub) return
  await api('/api/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe()
}
