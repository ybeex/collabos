import type { Metadata } from 'next'
import { OnboardingWizard } from '@/components/workspace/onboarding-wizard'

export const metadata: Metadata = { title: 'New workspace' }

export default function NewWorkspacePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl tracking-tight">Collab<span className="text-accent">OS</span></h1>
          <p className="font-mono text-sm text-muted-foreground mt-1">Create a new workspace</p>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  )
}
