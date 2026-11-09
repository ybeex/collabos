import { MarketingHome } from '@/components/marketing/home'

export const metadata = {
  title: 'CollabOS — The unified workspace for ambitious teams',
  description: 'Channels, docs, canvas, tasks, and AI intelligence in one workspace. No integrations. No context-switching. Built for teams that ship.',
  robots: { index: true, follow: true },
}

export default function RootPage() {
  return <MarketingHome />
}
