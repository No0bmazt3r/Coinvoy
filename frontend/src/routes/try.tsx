import { createFileRoute, redirect } from '@tanstack/react-router'
import { meQuery, post } from '../lib/api'
import { markIntroSeen } from '../lib/intro'

// The pitch deck's QR code opens /try: one scan skips the intro and signs the visitor into the Abang Faiz demo.
// Someone already signed in just lands on their own home screen.
export const Route = createFileRoute('/try')({
  beforeLoad: async ({ context }) => {
    markIntroSeen()
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) {
      try {
        await post('/api/auth/demo')
      } catch {
        throw redirect({ to: '/login', search: { error: 'demo' } }) // demo switched off or unreachable: the normal sign-in page
      }
      await context.queryClient.fetchQuery({ ...meQuery, staleTime: 0 })
    }
    throw redirect({ to: '/' })
  },
})
