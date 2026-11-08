import type { Metadata } from 'next'
import { DocsListView } from '@/components/docs/docs-list-view'

export const metadata: Metadata = { title: 'Docs' }

interface DocsPageProps {
  params: Promise<{ workspaceSlug: string }>
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { workspaceSlug } = await params
  return <DocsListView workspaceSlug={workspaceSlug} />
}
