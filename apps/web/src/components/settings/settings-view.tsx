'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor, User, Palette, Bell, Shield, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toaster'
import { authedFetch, workspacesApi } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Workspace } from '@collabos/shared'

type SettingsSection = 'profile' | 'appearance' | 'notifications' | 'workspace' | 'security'

interface SettingsViewProps {
  workspaceSlug: string
}

export const SettingsView = ({ workspaceSlug }: SettingsViewProps) => {
  const [section, setSection] = useState<SettingsSection>('profile')

  const SECTIONS: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'workspace', label: 'Workspace', icon: Shield },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings sidebar */}
      <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-card p-3 gap-0.5">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase px-2 py-1 mb-1">Settings</p>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              'flex items-center gap-2.5 rounded px-2.5 py-2 text-left font-mono text-xs transition-colors',
              section === id ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </aside>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-lg">
          {section === 'profile' && <ProfileSection />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'workspace' && <WorkspaceSection workspaceSlug={workspaceSlug} />}
          {section === 'security' && <SecuritySection />}
        </div>
      </div>
    </div>
  )
}

const ProfileSection = () => {
  const { user, setUser } = useAuthStore()
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const updated = await authedFetch<typeof user>('/v1/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      })
      if (updated) setUser(updated)
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display font-bold text-xl tracking-tight mb-1">Profile</h2>
        <p className="font-mono text-xs text-muted-foreground">How you appear to teammates</p>
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <Avatar src={user.avatarUrl} name={user.name} userId={user.id} size="lg" />
          <div>
            <p className="font-mono text-sm font-semibold">{user.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
            <Badge variant={user.plan === 'free' ? 'default' : 'success'} className="mt-1">
              {user.plan}
            </Badge>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">Display name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">Email</label>
          <Input value={user?.email ?? ''} disabled className="opacity-60" />
          <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">Email cannot be changed here</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim() || name === user?.name} className="w-fit">
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

const AppearanceSection = () => {
  const { theme, setTheme } = useTheme()

  const themes = [
    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Ink theme — default' },
    { id: 'light', label: 'Light', icon: Sun, desc: 'Paper theme' },
    { id: 'system', label: 'System', icon: Monitor, desc: 'Follow OS preference' },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display font-bold text-xl tracking-tight mb-1">Appearance</h2>
        <p className="font-mono text-xs text-muted-foreground">Choose your preferred theme</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {themes.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => setTheme(id)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded border transition-all',
              theme === id ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/40',
            )}
            aria-pressed={theme === id}
          >
            <Icon className={cn('h-5 w-5', theme === id ? 'text-accent' : 'text-muted-foreground')} />
            <span className="font-mono text-xs font-medium">{label}</span>
            <span className="font-mono text-[10px] text-muted-foreground text-center">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const NotificationsSection = () => {
  const [prefs, setPrefs] = useState({ mentions: true, allMessages: false, taskUpdates: true, weeklyDigest: true })

  const toggle = (key: keyof typeof prefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display font-bold text-xl tracking-tight mb-1">Notifications</h2>
        <p className="font-mono text-xs text-muted-foreground">Control what sends you a notification</p>
      </div>
      <div className="flex flex-col gap-4">
        {([
          { key: 'mentions' as const, label: 'Mentions', desc: 'When someone @mentions you' },
          { key: 'allMessages' as const, label: 'All messages', desc: 'Every message in channels you belong to' },
          { key: 'taskUpdates' as const, label: 'Task updates', desc: 'When tasks assigned to you change status' },
          { key: 'weeklyDigest' as const, label: 'Weekly digest', desc: 'Sunday summary email of workspace activity' },
        ]).map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <p className="font-mono text-sm">{label}</p>
              <p className="font-mono text-xs text-muted-foreground">{desc}</p>
            </div>
            <button
              onClick={() => toggle(key)}
              role="switch"
              aria-checked={prefs[key]}
              className={cn(
                'relative h-5 w-9 rounded-full transition-colors',
                prefs[key] ? 'bg-accent' : 'bg-muted border border-border',
              )}
            >
              <span className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                prefs[key] ? 'translate-x-4' : 'translate-x-0.5',
              )} />
            </button>
          </div>
        ))}
      </div>
      <Button className="w-fit" onClick={() => toast.success('Notification preferences saved')}>Save preferences</Button>
    </div>
  )
}

const WorkspaceSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const queryClient = useQueryClient()
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.list() as Promise<Array<{ workspace: Workspace; role: string }>>,
  })
  const workspace = workspaces?.find((m) => m.workspace.slug === workspaceSlug)
  const [name, setName] = useState(workspace?.workspace.name ?? '')

  const updateWorkspace = useMutation({
    mutationFn: (data: { name: string }) =>
      authedFetch(`/v1/workspaces/${workspace?.workspace.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workspaces'] }); toast.success('Workspace updated') },
    onError: () => toast.error('Failed to update workspace'),
  })

  if (!workspace) return null
  const isAdmin = ['owner', 'admin'].includes(workspace.role ?? '')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display font-bold text-xl tracking-tight mb-1">Workspace</h2>
        <p className="font-mono text-xs text-muted-foreground">{workspace.workspace.name}</p>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">Workspace name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">Plan</label>
          <Badge variant={workspace.workspace.plan === 'free' ? 'default' : 'success'}>
            {workspace.workspace.plan}
          </Badge>
        </div>
        {isAdmin && (
          <Button onClick={() => updateWorkspace.mutate({ name })} disabled={updateWorkspace.isPending || name === workspace.workspace.name} className="w-fit">
            {updateWorkspace.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        )}
      </div>
    </div>
  )
}

const SecuritySection = () => {
  const { logout } = useAuthStore()
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display font-bold text-xl tracking-tight mb-1">Security</h2>
        <p className="font-mono text-xs text-muted-foreground">Manage your account security</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="border border-border rounded p-4">
          <p className="font-mono text-sm font-medium mb-1">Change password</p>
          <p className="font-mono text-xs text-muted-foreground mb-3">Use a strong, unique password for your account.</p>
          <Button variant="outline" size="sm" onClick={() => router.push('/auth/forgot-password')}>
            Reset password via email
          </Button>
        </div>
        <div className="border border-[var(--color-error)] rounded p-4">
          <p className="font-mono text-sm font-medium text-[var(--color-error)] mb-1">Sign out of all devices</p>
          <p className="font-mono text-xs text-muted-foreground mb-3">This will revoke all active sessions.</p>
          <Button variant="destructive" size="sm" onClick={async () => { await logout(); router.replace('/auth/login') }}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Sign out everywhere
          </Button>
        </div>
      </div>
    </div>
  )
}
