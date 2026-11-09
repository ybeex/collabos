'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Briefcase, Code2, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@collabos/shared'

// PRD_AUDIT.md Finding #9: PRD §14 Flow 1, Role Selection step —
// "PM/Dev/Designer, sets default layout." A simple 3-card selector,
// PATCHes the existing /v1/auth/me endpoint (already accepts partial
// updates — no new endpoint needed). "Sets default layout" is honestly
// scoped to which module the workspace root redirects to by default; see
// workspace-index-redirect.tsx.
type OnboardingRole = 'pm' | 'dev' | 'designer'

const ROLES: Array<{ id: OnboardingRole; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'pm', label: 'Product / Project Manager', description: 'Lands on Tasks by default', icon: Briefcase },
  { id: 'dev', label: 'Developer', description: 'Lands on Channels by default', icon: Code2 },
  { id: 'designer', label: 'Designer', description: 'Lands on Canvas by default', icon: Palette },
]

interface OnboardingRoleStepProps {
  onDone: () => void
}

export const OnboardingRoleStep = ({ onDone }: OnboardingRoleStepProps) => {
  const [selected, setSelected] = useState<OnboardingRole | null>(null)
  const setUser = useAuthStore((s) => s.setUser)

  const saveRole = useMutation({
    mutationFn: (role: OnboardingRole) => authApi.updateMe({ onboardingRole: role }),
    onSuccess: (user) => {
      setUser(user as User)
      onDone()
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display font-bold text-xl">What&rsquo;s your role?</h2>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          We&rsquo;ll set your default landing page. You can change this later.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {ROLES.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelected(id)}
            className={cn(
              'flex items-center gap-3 border px-4 py-3 text-left transition-colors',
              selected === id ? 'border-accent bg-accent/5' : 'border-border hover:bg-muted/30',
            )}
            aria-pressed={selected === id}
          >
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded',
              selected === id ? 'bg-accent/10' : 'bg-muted',
            )}>
              <Icon className={cn('h-4 w-4', selected === id ? 'text-accent' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className="font-mono text-sm font-medium">{label}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{description}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Button
          type="button"
          className="flex-1"
          disabled={!selected || saveRole.isPending}
          onClick={() => selected && saveRole.mutate(selected)}
        >
          {saveRole.isPending ? 'Saving...' : 'Continue'}
        </Button>
        {/* PRD §14: every step in this flow must be skippable. */}
        <Button type="button" variant="ghost" onClick={onDone} disabled={saveRole.isPending}>
          Skip
        </Button>
      </div>
    </div>
  )
}
