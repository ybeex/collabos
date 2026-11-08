import { WorkspaceLayout } from '@/components/layout/workspace-layout'

interface WorkspaceRootLayoutProps {
  children: React.ReactNode
}

export default function WorkspaceRootLayout({ children }: WorkspaceRootLayoutProps) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>
}
