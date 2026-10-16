import { createFileRoute } from '@tanstack/react-router'
import { Camera } from 'lucide-react'
import { ComingSoon } from '../../components/ComingSoon'

export const Route = createFileRoute('/_app/snap')({
  component: () => <ComingSoon title="snap.title" body="snap.soonBody" icon={Camera} back />,
})
