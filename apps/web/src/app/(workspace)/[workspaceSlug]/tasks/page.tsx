import type { Metadata } from 'next'
import { TasksView } from '@/components/tasks/tasks-view'

export const metadata: Metadata = { title: 'Tasks' }

interface TasksPageProps {
  params: Promise<{ workspaceSlug: string }>
}

export default async function TasksPage({ params }: TasksPageProps) {
  const { workspaceSlug } = await params
  return <TasksView workspaceSlug={workspaceSlug} />
}
