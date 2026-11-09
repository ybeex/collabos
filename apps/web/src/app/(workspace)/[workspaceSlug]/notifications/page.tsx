import type { Metadata } from 'next'
import { NotificationsView } from '@/components/notifications/notifications-view'

export const metadata: Metadata = { title: 'Notifications' }

interface NotificationsPageProps {
  params: Promise<{ workspaceSlug: string }>
}

// BUG-8 fix: this route did not exist before. NotificationBell (desktop)
// is a dropdown panel, which works fine at desktop width but has no mobile
// equivalent — and WorkspaceRail (where NotificationBell lives) is hidden
// below the md breakpoint entirely. This full page gives mobile users
// (via the new "More" sheet in MobileNav) and desktop users alike a
// dedicated place to review and manage notifications beyond the dropdown's
// limited list.
export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { workspaceSlug } = await params
  return <NotificationsView workspaceSlug={workspaceSlug} />
}
