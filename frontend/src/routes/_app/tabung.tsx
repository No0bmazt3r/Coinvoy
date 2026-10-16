import { createFileRoute } from '@tanstack/react-router'
import { PiggyBank } from 'lucide-react'
import { ComingSoon } from '../../components/ComingSoon'

export const Route = createFileRoute('/_app/tabung')({
  component: () => <ComingSoon title="tabung.title" body="tabung.soonBody" icon={PiggyBank} />,
})
