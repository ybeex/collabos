import type { Metadata } from 'next'
import { DocView } from '@/components/docs/doc-view'

interface DocPageProps {
  params: Promise<{ workspaceSlug: string; docId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  // Static title, not derived from docId: this runs server-side, and this
  // app's auth is entirely client-side (JWT in memory/localStorage, no
  // server session) — there's no way to authenticate a fetch for this
  // specific document's real title here. Not a missed feature; a dynamic
  // per-document title isn't feasible without a bigger auth architecture
  // change (e.g. a public preview endpoint or cookie-based sessions).
  return { title: `Document` }
}

export default async function DocPage({ params }: DocPageProps) {
  const { workspaceSlug, docId } = await params
  return <DocView workspaceSlug={workspaceSlug} docId={docId} />
}
