import type { Metadata } from 'next'
import { CanvasView } from '@/components/canvas/canvas-view'

export const metadata: Metadata = { title: 'Canvas' }

interface CanvasPageProps {
  params: Promise<{ workspaceSlug: string; canvasId: string }>
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { workspaceSlug, canvasId } = await params
  return <CanvasView workspaceSlug={workspaceSlug} canvasId={canvasId} />
}
