import type { Metadata } from 'next'
import { AIView } from '@/components/ai/ai-view'

export const metadata: Metadata = { title: 'Intelligence' }

interface AIPageProps {
  params: Promise<{ workspaceSlug: string }>
}

export default async function AIPage({ params }: AIPageProps) {
  const { workspaceSlug } = await params
  return <AIView workspaceSlug={workspaceSlug} />
}
