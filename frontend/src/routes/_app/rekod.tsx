import { createFileRoute } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import { ComingSoon } from '../../components/ComingSoon'

export const Route = createFileRoute('/_app/rekod')({
  component: () => <ComingSoon title="rekod.title" body="rekod.soonBody" icon={FileText} />,
})
