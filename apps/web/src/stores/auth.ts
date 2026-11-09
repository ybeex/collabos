import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@collabos/shared'
import { setAccessToken, clearAccessToken, authApi, registerRefreshHandler } from '@/lib/api-client'

interface AuthState {
  user: User | null
  refreshToken: string | null
  isLoading: boolean
  /**
   * True only once the current in-memory access token has been validated
   * (or re-issued) THIS load. Never trust this across a reload — it is
   * intentionally re-derived by refresh(), not persisted as truth.
   * See BUG-1 in AUDIT_REPORT.md.
   */
  isAuthenticated: boolean
  /**
   * True once the initial session-restore attempt (refresh() on mount)
   * has completed, success or failure. Consumers should gate rendering
   * on this rather than on isAuthenticated alone, so we never flash the
   * authenticated UI before the session has actually been verified.
   */
  hasCheckedSession: boolean

  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /**
   * Always safe to call unconditionally on mount. Returns false (and
   * clears state) if there is no refresh token or it is no longer valid.
   * This must run on every fresh load regardless of any previously
   * persisted isAuthenticated value — that value is never trusted as
   * session truth, only as a hint for the loading skeleton.
   */
  refresh: () => Promise<boolean>
  setUser: (user: User) => void
}

interface LoginResponse {
  user: User
  accessToken: string
  refreshToken: string
}

interface RegisterResponse {
  user: User
  accessToken: string
  refreshToken: string
}

interface RefreshResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,
      hasCheckedSession: false,

      login: async (email: string, password: string): Promise<void> => {
        set({ isLoading: true })
        try {
          const res = await authApi.login({ email, password }) as LoginResponse
          setAccessToken(res.accessToken)
          set({
            user: res.user,
            refreshToken: res.refreshToken,
            isAuthenticated: true,
            hasCheckedSession: true,
            isLoading: false,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      register: async (name: string, email: string, password: string): Promise<void> => {
        set({ isLoading: true })
        try {
          const res = await authApi.register({ name, email, password }) as RegisterResponse
          setAccessToken(res.accessToken)
          set({
            user: res.user,
            refreshToken: res.refreshToken,
            isAuthenticated: true,
            hasCheckedSession: true,
            isLoading: false,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: async (): Promise<void> => {
        const { refreshToken } = get()
        try {
          if (refreshToken) await authApi.logout(refreshToken)
        } finally {
          clearAccessToken()
          set({ user: null, refreshToken: null, isAuthenticated: false, hasCheckedSession: true })
        }
      },

      refresh: async (): Promise<boolean> => {
        const { refreshToken } = get()
        if (!refreshToken) {
          clearAccessToken()
          set({ user: null, isAuthenticated: false, hasCheckedSession: true })
          return false
        }

        try {
          const res = await authApi.refresh(refreshToken) as RefreshResponse
          setAccessToken(res.accessToken)
          set({ refreshToken: res.refreshToken, isAuthenticated: true, hasCheckedSession: true })

          // FINAL_SWEEP.md latent-issue fix: refresh() previously never
          // repopulated `user` — it relied entirely on `user` having
          // survived from a prior login()/register() call via
          // localStorage persistence. That worked for the common case
          // (same browser, never cleared) but left a real correctness
          // gap: any future code path that nulls `user` without also
          // nulling `refreshToken` (or a multi-tab logout/refresh race)
          // would leave isAuthenticated=true with user=null, which
          // SuperAdminGuard reads as `current?.isSuperAdmin` →
          // `undefined` → falsy, incorrectly bouncing a legitimate
          // super admin to "/". Fetching /v1/auth/me here makes `user`
          // authoritative on every successful refresh, not just on the
          // two flows (login, register) that happened to set it.
          //
          // Failure to fetch the profile is non-fatal to the refresh
          // itself — the access/refresh token pair is already valid at
          // this point — but is logged so a silent profile-staleness
          // issue doesn't go unnoticed.
          try {
            const profile = await authApi.me() as User
            set({ user: profile })
          } catch (profileErr) {
            console.error('Failed to refresh user profile after token refresh:', profileErr)
          }

          return true
        } catch {
          clearAccessToken()
          set({ user: null, refreshToken: null, isAuthenticated: false, hasCheckedSession: true })
          return false
        }
      },

      // Explicit block body — bug fix (found via real tsc pass): an
      // implicit-return arrow (`=> set({ user })`) with the whole arrow
      // explicitly annotated `: void` was flagged by TS as "unknown is
      // not assignable to void" here because zustand's `set` return type
      // isn't `void` on this store. TS silently discards non-void
      // implicit-return values in most callback-typed positions, but not
      // when `: void` is written directly on the arrow itself — wrapping
      // in a block body sidesteps the distinction entirely rather than
      // relying on either behavior.
      setUser: (user: User): void => { set({ user }) },
    }),
    {
      name: 'collabos-auth',
      // Only persist refreshToken and user. isAuthenticated is deliberately
      // NOT trusted from storage as session truth (BUG-1) — it is always
      // false on rehydration and only flips true after refresh() actually
      // validates the refresh token against the server. hasCheckedSession
      // is also never persisted: every fresh load must re-verify.
      partialize: (state: AuthState) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      // On rehydration from localStorage, explicitly force isAuthenticated
      // and hasCheckedSession back to their safe defaults so a stale value
      // can never leak through, even if older persisted state (from before
      // this fix) still contains an isAuthenticated key in localStorage.
      onRehydrateStorage: () => (state: AuthState | undefined): void => {
        if (state) {
          state.isAuthenticated = false
          state.hasCheckedSession = false
        }
      },
    },
  ),
)

// BUG-2 fix (AUDIT_REPORT.md): register this store's refresh() with
// api-client's global 401 interceptor. This is what actually closes the
// gap — without this line, authedFetch's getOrStartRefresh() would have
// nothing to call and every 401 would still propagate as a raw error
// with no recovery attempt.
registerRefreshHandler((): Promise<boolean> => useAuthStore.getState().refresh())
