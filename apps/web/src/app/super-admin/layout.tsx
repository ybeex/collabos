import { SuperAdminGuard } from '@/components/super-admin/super-admin-guard'

export const metadata = {
  title: { default: 'Super Admin', template: '%s — Super Admin — CollabOS' },
  robots: { index: false, follow: false },
}

// Deliberately a completely separate layout tree from (workspace)/layout.tsx
// (WorkspaceLayout). This route group has no workspace context at all — no
// WorkspaceRail, no ModuleSidebar, no currentWorkspace dependency anywhere.
// Mixing this into the workspace layout tree would risk exactly the kind
// of "implemented but not properly isolated" gap the prior audit's BUG-3
// found in the canvas component — a structurally separate tree makes the
// isolation a property of the file layout, not just a runtime check.
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminGuard>{children}</SuperAdminGuard>
}
