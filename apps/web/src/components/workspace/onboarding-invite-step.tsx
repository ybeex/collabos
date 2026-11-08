'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { workspacesApi } from '@/lib/api-client'

// PRD_AUDIT.md Finding #9: PRD §14 Flow 1, Invite Team step. Reuses the
// existing POST /v1/workspaces/:id/invite endpoint (already built, already
// sends the invite email) — one call per address, run in sequence so a
// failure on one address doesn't need to be diffed against a batch result.
interface OnboardingInviteStepProps {
  workspaceId: string
  onDone: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const OnboardingInviteStep = ({ workspaceId, onDone }: OnboardingInviteStepProps) => {
  const [emails, setEmails] = useState<string[]>([''])
  const [error, setError] = useState<string | null>(null)

  const sendInvites = useMutation({
    mutationFn: async (addresses: string[]) => {
      for (const email of addresses) {
        await workspacesApi.invite(workspaceId, { email, role: 'member' })
      }
    },
    onSuccess: onDone,
    onError: () => setError('Some invites failed to send. You can invite teammates later from workspace settings.'),
  })

  const updateEmail = (i: number, value: string) => {
    setEmails((prev) => prev.map((e, idx) => (idx === i ? value : e)))
    setError(null)
  }

  const addRow = () => setEmails((prev) => [...prev, ''])
  const removeRow = (i: number) => setEmails((prev) => prev.filter((_, idx) => idx !== i))

  const handleSubmit = () => {
    const valid = emails.map((e) => e.trim()).filter((e) => e.length > 0)
    if (valid.length === 0) {
      onDone()
      return
    }
    if (!valid.every((e) => EMAIL_RE.test(e))) {
      setError('Enter valid email addresses, or leave blank to skip.')
      return
    }
    sendInvites.mutate(valid)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display font-bold text-xl">Invite your team</h2>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          They&rsquo;ll get an email invite. Optional — you can do this anytime.
        </p>
      </div>
      {error && (
        <div className="border border-[var(--color-error)] bg-[var(--color-error-bg)] px-3 py-2">
          <p className="font-mono text-xs text-[var(--color-error)]">{error}</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {emails.map((email, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => updateEmail(i, e.target.value)}
              placeholder="teammate@company.com"
              disabled={sendInvites.isPending}
              aria-label={`Teammate email ${i + 1}`}
            />
            {emails.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeRow(i)}
                disabled={sendInvites.isPending}
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addRow}
          disabled={sendInvites.isPending || emails.length >= 10}
          className="self-start"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add another
        </Button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Button type="button" className="flex-1" onClick={handleSubmit} disabled={sendInvites.isPending}>
          {sendInvites.isPending ? 'Sending invites...' : 'Continue'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={sendInvites.isPending}>
          Skip
        </Button>
      </div>
    </div>
  )
}
