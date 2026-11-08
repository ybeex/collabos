import { WorkspaceIndexRedirect } from '@/components/workspace/workspace-index-redirect'

interface WorkspaceIndexProps {
  params: Promise<{ workspaceSlug: string }>
}

// PRD_AUDIT.md Finding #9: previously an unconditional
// redirect(`/${workspaceSlug}/channels`). Onboarding role (which now
// determines the default landing module) lives in client-side auth
// state, not anything readable server-side in this app, so the actual
// redirect decision happens in WorkspaceIndexRedirect — this server
// component's only job left is unwrapping the async `params`.
export default async function WorkspaceIndexPage({ params }: WorkspaceIndexProps) {
  const { workspaceSlug } = await params
  return <WorkspaceIndexRedirect workspaceSlug={workspaceSlug} />
}
