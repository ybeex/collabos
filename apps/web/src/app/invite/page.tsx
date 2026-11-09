import type { Metadata } from 'next'
import { InviteAcceptView } from '@/components/workspace/invite-accept-view'

export const metadata: Metadata = { title: 'Accept invitation' }

interface InvitePageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const { token } = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl tracking-tight">
            Collab<span className="text-accent">OS</span>
          </h1>
        </div>
        <InviteAcceptView token={token ?? ''} />
      </div>
    </div>
  )
}
