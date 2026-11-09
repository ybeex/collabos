import type { Metadata } from 'next'
import { ChannelView } from '@/components/channels/channel-view'

interface ChannelPageProps {
  params: Promise<{ workspaceSlug: string; channelId: string }>
}

export async function generateMetadata({ params }: ChannelPageProps): Promise<Metadata> {
  const { channelId } = await params
  return { title: `#${channelId}` }
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { workspaceSlug, channelId } = await params
  return <ChannelView workspaceSlug={workspaceSlug} channelId={channelId} />
}
