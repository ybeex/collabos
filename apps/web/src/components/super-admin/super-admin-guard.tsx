'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { SuperAdminNav } from './super-admin-nav'

interface SuperAdminGuardProps {
  children: React.ReactNode
}

/**
 * Gates every /super-admin/* route. Mirrors WorkspaceLayout's session-
 * verification discipline (see BUG-1 in AUDIT_REPORT.md: never trust a
 * previously persisted boolean as session truth, always re-verify on
 * mount, never render protected content before verification completes)
 * and adds a second, independent gate on top: user.isSuperAdmin.
 *
 * This is a CLIENT-SIDE check only — the real authorization boundary is
 * the backend's requireSuperAdmin / requireSuperAdminVerified middleware,
 * which this UI cannot bypass even if this component were somehow
 * tricked into rendering. This guard exists purely so a non-super-admin
 * user gets redirected immediately rather than seeing a flash of UI
 * followed by every API call failing with 403 — it is a UX improvement
 * layered on top of real server-side enforcement, never a substitute
 * for it.
 */
export const SuperAdminGuard = ({ children }: SuperAdminGuardProps): React.JSX.Element => {
  const { user, hasCheckedSession, isAuthenticated, refresh } = useAuthStore()
  const router = useRouter()
  const checkRanRef = useRef<boolean>(false)
  const [denied, setDenied] = useState<boolean>(false)

  useEffect(() => {
    if (checkRanRef.current) return
    checkRanRef.current = true

    refresh().then((ok: boolean): void => {
      if (!ok) {
        router.replace('/auth/login')
        return
      }
      // FINAL_SWEEP.md fix: this comment previously asserted "user is
      // populated by the time refresh() resolves successfully" as if it
      // were already true — it was not. refresh() only set refreshToken/
      // isAuthenticated/hasCheckedSession and relied entirely on `user`
      // having survived from an earlier login()/register() call via
      // localStorage. That left a real gap: if user were ever null while
      // refreshToken remained valid, this read undefined?.isSuperAdmin
      // and incorrectly denied a legitimate super admin. refresh() now
      // fetches /v1/auth/me on success (see stores/auth.ts), making this
      // comment's original claim actually true rather than aspirational.
      const current = useAuthStore.getState().user
      if (!current?.isSuperAdmin) {
        setDenied(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirect away on denial, but only after the effect above has actually
  // run the check — never on the basis of a still-loading user object,
  // which would incorrectly redirect a legitimate super admin whose user
  // data simply hasn't arrived yet.
  useEffect(() => {
    if (denied) router.replace('/')
  }, [denied, router])

  // BUG-1-style gating: render nothing — not even a layout shell — until
  // session AND super-admin status have both been verified. A regular
  // user must never see so much as a flash of this dashboard's chrome.
  if (!hasCheckedSession || !isAuthenticated || denied || !user?.isSuperAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="font-mono text-xs text-muted-foreground">Verifying access</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SuperAdminNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
