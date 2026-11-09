import type { Metadata } from 'next'
import { GraphView } from '@/components/graph/graph-view'

// PRD_AUDIT.md Finding #3: this route did not exist at all — PRD §13
// specifies app.collabos.io/:workspace/graph/:item-id "shows any item +
// all its cross-layer links," and §21 names the Work Graph as the
// product's primary defensible moat.
interface GraphPageProps {
  params: Promise<{ workspaceSlug: string; itemId: string }>
  searchParams: Promise<{ type?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  // Static title: same reasoning as docs/[docId]/page.tsx — this app's
  // auth is entirely client-side, so a server-rendered per-item title
  // isn't feasible here.
  return { title: 'Work Graph' }
}

export default async function GraphPage({ params, searchParams }: GraphPageProps) {
  const { workspaceSlug, itemId } = await params
  const { type } = await searchParams
  return <GraphView workspaceSlug={workspaceSlug} itemId={itemId} entityType={type ?? 'task'} />
}
