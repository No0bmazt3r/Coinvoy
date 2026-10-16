import { createFileRoute } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'
import { ComingSoon } from '../../components/ComingSoon'

export const Route = createFileRoute('/_app/tanya')({
  component: () => <ComingSoon title="tanya.title" body="tanya.soonBody" icon={MessageCircle} />,
})
