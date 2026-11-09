'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { workspacesApi, ApiClientError } from '@/lib/api-client'
import { slugify } from '@collabos/shared'

interface CreatedWorkspace {
  id: string
  slug: string
  name: string
}

interface NewWorkspaceFormProps {
  // PRD_AUDIT.md Finding #9: onboarding Flow 1 — Workspace Setup is now
  // step 1 of a multi-step wizard (see onboarding-wizard.tsx) rather than
  // navigating away immediately on success.
  onCreated: (workspace: CreatedWorkspace) => void
}

export const NewWorkspaceForm = ({ onCreated }: NewWorkspaceFormProps) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; slug?: string; form?: string }>({})

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugEdited) setSlug(slugify(v))
    setErrors({})
  }

  const handleSlugChange = (v: string) => {
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    setSlugEdited(true)
    setErrors({})
  }

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Workspace name is required'
    if (!slug) next.slug = 'Slug is required'
    else if (slug.length < 2) next.slug = 'Slug must be at least 2 characters'
    else if (!/^[a-z0-9-]+$/.test(slug)) next.slug = 'Slug must only contain lowercase letters, numbers, and hyphens'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const createWorkspace = useMutation({
    mutationFn: () => workspacesApi.create({ name: name.trim(), slug }),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      onCreated(workspace as CreatedWorkspace)
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setErrors({ slug: 'This slug is already taken. Choose a different one.' })
      } else {
        setErrors({ form: 'Failed to create workspace. Please try again.' })
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    createWorkspace.mutate()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {errors.form && (
        <div className="border border-[var(--color-error)] bg-[var(--color-error-bg)] px-3 py-2">
          <p className="font-mono text-xs text-[var(--color-error)]">{errors.form}</p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ws-name" className="font-mono text-xs text-muted-foreground">Workspace name</label>
        <Input id="ws-name" type="text" value={name} onChange={(e) => handleNameChange(e.target.value)}
          error={errors.name} placeholder="Acme Corp" autoFocus disabled={createWorkspace.isPending} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ws-slug" className="font-mono text-xs text-muted-foreground">URL slug</label>
        <div className="flex items-center gap-0">
          <span className="font-mono text-xs text-muted-foreground border border-r-0 border-border bg-muted px-3 h-9 flex items-center shrink-0">
            app.collabos.io/
          </span>
          <Input id="ws-slug" type="text" value={slug} onChange={(e) => handleSlugChange(e.target.value)}
            error={errors.slug} placeholder="acme-corp" disabled={createWorkspace.isPending}
            className="rounded-l-none" />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/60">
          Lowercase letters, numbers, and hyphens only. Cannot be changed later.
        </p>
      </div>
      <Button type="submit" className="w-full mt-2" disabled={createWorkspace.isPending || !name.trim() || !slug}>
        {createWorkspace.isPending ? 'Creating workspace...' : 'Continue'}
      </Button>
    </form>
  )
}

