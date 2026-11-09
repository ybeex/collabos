import type { Metadata } from 'next'
import { CanvasListView } from '@/components/canvas/canvas-list-view'

export const metadata: Metadata = { title: 'Canvas' }

interface CanvasIndexPageProps {
  params: Promise<{ workspaceSlug: string }>
}

export default async function CanvasIndexPage({ params }: CanvasIndexPageProps) {
  const { workspaceSlug } = await params
  return <CanvasListView workspaceSlug={workspaceSlug} />
}
