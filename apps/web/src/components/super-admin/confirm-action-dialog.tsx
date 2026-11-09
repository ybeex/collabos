'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmActionDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void | Promise<void>
  title: string
  description: string
  confirmLabel: string
  requireReason?: boolean
  isDestructive?: boolean
  isPending?: boolean
}

/**
 * Deliberately built rather than reaching for window.confirm() — every
 * action this dialog guards (suspend workspace, suspend user, grant/
 * revoke super admin, change workspace plan) is logged permanently to
 * super_admin_audit_logs and is either immediately disruptive (workspace
 * suspension disconnects live users) or affects platform-wide authority
 * or billing. A native browser confirm() can't require a typed reason
 * and reads as no more serious than a "leave this page?" prompt — the
 * wrong register for this trust tier, and the kind of inconsistent
 * destructive-action UX the prior audit's UI/UX section specifically
 * flagged as a finding worth fixing rather than repeating.
 *
 * premium-ui-elevation /elevate-ui: previously a hand-rolled `if (!open)
 * return null` div, with no animation (instant teleport in/out), no
 * focus trap, no ESC-to-close, and no scroll lock — a real gap for a
 * dialog specifically guarding high-stakes, audit-logged actions.
 * Converted to Radix Dialog, which provides the latter three for free
 * (focus trap, ESC handling, scroll lock are all Radix Dialog defaults,
 * not something added here) and — the actual reason for the conversion —
 * makes a true EXIT animation possible: Radix keeps Content mounted
 * until its own exit animation/transition finishes (via its internal
 * Presence mechanism, driven by the data-state attribute it sets),
 * where the old `return null` unmounted instantly with nothing to
 * animate. Radix only provides the mechanism, though — entrance was
 * already handled (data-[state=open]:animate-[dialog-in...] below,
 * reusing the plain-CSS version's keyframe); the exit direction
 * (data-[state=closed]:animate-[dialog-out...]) still needed to be
 * authored, it doesn't come for free just from switching libraries.
 */
export const ConfirmActionDialog = ({
  open, onClose, onConfirm, title, description, confirmLabel,
  requireReason = true, isDestructive = true, isPending = false,
}: ConfirmActionDialogProps): React.JSX.Element => {
  const [reason, setReason] = useState<string>('')

  const canConfirm: boolean = !requireReason || reason.trim().length > 0

  const handleConfirm = (): void => {
    void onConfirm(reason.trim())
  }

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setReason(e.target.value)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in data-[state=closed]:animate-[fade-out_0.15s_var(--ease-out)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card shadow-2xl data-[state=open]:animate-[dialog-in_0.25s_var(--ease-spring)] data-[state=closed]:animate-[dialog-out_0.15s_var(--ease-out)]">
          <div className="flex items-start gap-3 p-5 border-b border-border">
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              isDestructive ? 'alert-icon-bg' : 'bg-accent/10',
            )}>
              <AlertTriangle className={cn('h-4.5 w-4.5', isDestructive ? 'text-[var(--color-error)]' : 'text-accent')} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="font-mono text-sm font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="font-mono text-xs text-muted-foreground mt-1">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                title="Close"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {requireReason && (
            <div className="p-5">
              <label htmlFor="confirm-reason" className="font-mono text-xs text-muted-foreground block mb-2">
                Reason (required — recorded in the audit log)
              </label>
              <textarea
                id="confirm-reason"
                title="Reason for this action"
                value={reason}
                onChange={handleReasonChange}
                rows={3}
                autoFocus
                className="w-full px-3 py-2 rounded border border-border bg-input font-mono text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_15%,transparent)] resize-none"
                placeholder="e.g. ToS violation reported, investigating non-payment, customer requested..."
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
            <Button type="button" variant="ghost" title="Cancel" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={isDestructive ? 'destructive' : 'accent'}
              title={confirmLabel}
              disabled={!canConfirm || isPending}
              onClick={handleConfirm}
            >
              {isPending ? 'Working...' : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
