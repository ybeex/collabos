'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewWorkspaceForm } from './new-workspace-form'
import { OnboardingRoleStep } from './onboarding-role-step'
import { OnboardingInviteStep } from './onboarding-invite-step'
import { OnboardingImportStep } from './onboarding-import-step'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

// PRD_AUDIT.md Finding #9: PRD §14 Flow 1 — Sign Up → Workspace Setup →
// Role Selection → Invite Team → Quick Import → pre-populated workspace.
// Sign Up already happens before this page is reachable (auth/register).
// The remaining four steps are wizard steps here. Every step past
// Workspace Setup has a Skip path per the PRD's explicit "skippable"
// requirement — Workspace Setup itself cannot be skipped since there is
// no workspace to attach the later steps (or land the user in) without it.
type Step = 'workspace' | 'role' | 'invite' | 'import'

const STEP_ORDER: Step[] = ['workspace', 'role', 'invite', 'import']
const STEP_LABELS: Record<Step, string> = {
  workspace: 'Workspace',
  role: 'Role',
  invite: 'Invite',
  import: 'Import',
}

const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  pm: 'tasks',
  dev: 'channels',
  designer: 'canvas',
}

export const OnboardingWizard = () => {
  const router = useRouter()
  const [step, setStep] = useState<Step>('workspace')
  const [workspace, setWorkspace] = useState<{ id: string; slug: string } | null>(null)
  const stepIndex = STEP_ORDER.indexOf(step)

  const finish = () => {
    if (!workspace) return
    const user = useAuthStore.getState().user
    const target = (user?.onboardingRole && ROLE_DEFAULT_ROUTE[user.onboardingRole]) || 'channels'
    router.replace(`/${workspace.slug}/${target}`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step progress indicator */}
      <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={STEP_ORDER.length} aria-label="Onboarding progress">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 flex-1">
            <div className={cn('h-1 flex-1 rounded-full', i <= stepIndex ? 'bg-accent' : 'bg-muted')} />
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] text-muted-foreground -mt-4">
        Step {stepIndex + 1} of {STEP_ORDER.length}: {STEP_LABELS[step]}
      </p>

      {step === 'workspace' && (
        <NewWorkspaceForm
          onCreated={(ws) => {
            setWorkspace({ id: ws.id, slug: ws.slug })
            setStep('role')
          }}
        />
      )}
      {step === 'role' && <OnboardingRoleStep onDone={() => setStep('invite')} />}
      {step === 'invite' && workspace && (
        <OnboardingInviteStep workspaceId={workspace.id} onDone={() => setStep('import')} />
      )}
      {step === 'import' && workspace && (
        <OnboardingImportStep workspaceId={workspace.id} onDone={finish} />
      )}
    </div>
  )
}
