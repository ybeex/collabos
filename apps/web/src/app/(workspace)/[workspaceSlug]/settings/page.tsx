import type { Metadata } from 'next'
import { SettingsView } from '@/components/settings/settings-view'

export const metadata: Metadata = { title: 'Settings' }

interface SettingsPageProps {
  params: Promise<{ workspaceSlug: string }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { workspaceSlug } = await params
  return <SettingsView workspaceSlug={workspaceSlug} />
}
