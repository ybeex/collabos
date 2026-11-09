import type { ApiError, User } from '@collabos/shared'

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export class ApiClientError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

let accessToken: string | null = null

export const setAccessToken = (token: string): void => { accessToken = token }
export const clearAccessToken = (): void => { accessToken = null }
export const getAccessToken = (): string | null => accessToken

// ── BUG-2 fix: global 401 interceptor with single-flight refresh-and-retry ──
//
// Previously, a 401 from an expired access token surfaced as a raw
// ApiClientError to whichever component happened to be calling authedFetch,
// with nothing anywhere triggering a token refresh. Combined with BUG-1
// (stale persisted isAuthenticated), this meant the app had no recovery
// path at all for "access token expired mid-session."
//
// This module cannot import useAuthStore directly (auth.ts imports THIS
// module for setAccessToken/clearAccessToken — a direct import back would
// be a circular dependency). Instead, auth.ts registers its refresh function
// here once, at module init, via registerRefreshHandler().
type RefreshHandler = () => Promise<boolean>
let refreshHandler: RefreshHandler | null = null
export const registerRefreshHandler = (handler: RefreshHandler): void => {
  refreshHandler = handler
}

// Single-flight guard: if N requests 401 at the same moment (e.g. a page
// that fires 5 parallel queries right as the token expires), we must only
// call refresh() once and let all five await the same in-flight promise —
// otherwise we'd hammer /v1/auth/refresh five times and risk the refresh
// token rotation race (rotation: reuse of an already-rotated refresh token
// revokes ALL sessions, by design, to detect replay attacks).
let inFlightRefresh: Promise<boolean> | null = null
const getOrStartRefresh = (): Promise<boolean> => {
  if (!refreshHandler) return Promise.resolve(false)
  if (!inFlightRefresh) {
    inFlightRefresh = refreshHandler().finally(() => {
      inFlightRefresh = null
    })
  }
  return inFlightRefresh
}

const parseErrorBody = async (res: Response): Promise<ApiError> => {
  try {
    return (await res.json()) as ApiError
  } catch {
    return { statusCode: res.status, error: 'UNKNOWN', message: res.statusText, code: 'UNKNOWN', requestId: '' }
  }
}

const doFetch = async (path: string, options: RequestInit): Promise<Response> => {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}

// Auth endpoints must never trigger the refresh-and-retry loop themselves —
// a 401 from /v1/auth/login or /v1/auth/refresh means "bad credentials" or
// "refresh token itself is invalid," not "access token expired," and
// attempting to refresh in response to either would either be meaningless
// or recursive.
const REFRESH_EXEMPT_PATHS = ['/v1/auth/login', '/v1/auth/register', '/v1/auth/refresh', '/v1/auth/logout']

export const authedFetch = async <T>(path: string, options: RequestInit = {}, _isRetry = false): Promise<T> => {
  const res = await doFetch(path, options)

  if (res.status === 401 && !_isRetry && !REFRESH_EXEMPT_PATHS.some((p) => path.startsWith(p))) {
    const refreshed = await getOrStartRefresh()
    if (refreshed) {
      // Retry exactly once with the new access token. _isRetry prevents
      // a second refresh attempt if the retry also 401s (e.g. the server
      // revoked the session entirely) — in that case we surface the error
      // rather than looping.
      return authedFetch<T>(path, options, true)
    }
    // Refresh failed — the session truly cannot be restored. Clear local
    // state so the UI reflects "logged out" rather than silently retrying
    // forever, and let the original 401 propagate to the caller below.
  }

  if (!res.ok) {
    const body = await parseErrorBody(res)
    throw new ApiClientError(body.statusCode, body.code, body.message, body.details)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    authedFetch<{ user: User; accessToken: string; refreshToken: string }>('/v1/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    authedFetch<{ user: User; accessToken: string; refreshToken: string }>('/v1/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  refresh: (refreshToken: string) =>
    authedFetch<{ accessToken: string; refreshToken: string; expiresIn: number }>('/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  logout: (refreshToken: string) =>
    authedFetch('/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  me: () => authedFetch<User>('/v1/auth/me'),

  // PRD_AUDIT.md Finding #9: onboarding Role Selection step PATCHes this.
  updateMe: (data: { name?: string; timezone?: string; avatarUrl?: string | null; onboardingRole?: 'pm' | 'dev' | 'designer' }) =>
    authedFetch<User>('/v1/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  forgotPassword: (email: string) =>
    authedFetch('/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    authedFetch('/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
}

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const workspacesApi = {
  list: () => authedFetch('/v1/workspaces'),
  get: (id: string) => authedFetch(`/v1/workspaces/${id}`),
  create: (data: { name: string; slug: string; description?: string }) =>
    authedFetch('/v1/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    authedFetch(`/v1/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  members: (id: string) => authedFetch(`/v1/workspaces/${id}/members`),
  invite: (id: string, data: { email: string; role: string }) =>
    authedFetch(`/v1/workspaces/${id}/invite`, { method: 'POST', body: JSON.stringify(data) }),
  // PRD_AUDIT.md Finding #9: onboarding Quick Import (CSV) step.
  importCsv: (id: string, rows: Array<{ channelName: string; authorEmail: string; content: string; timestamp?: string }>) =>
    authedFetch(`/v1/workspaces/${id}/import/csv`, { method: 'POST', body: JSON.stringify({ rows }) }),
}

// ─── Channels ─────────────────────────────────────────────────────────────────
export const channelsApi = {
  list: (workspaceId: string) => authedFetch(`/v1/channels?workspaceId=${workspaceId}`),
  get: (channelId: string) => authedFetch(`/v1/channels/${channelId}`),
  create: (data: { workspaceId: string; name: string; type?: string }) =>
    authedFetch('/v1/channels', { method: 'POST', body: JSON.stringify(data) }),
  messages: (channelId: string, cursor?: string, limit = 50) =>
    authedFetch(`/v1/channels/${channelId}/messages?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  markRead: (channelId: string) =>
    authedFetch(`/v1/channels/${channelId}/read`, { method: 'PATCH' }),
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messagesApi = {
  create: (data: { channelId: string; content: string; threadId?: string }, idempotencyKey: string) =>
    authedFetch('/v1/messages', { method: 'POST', body: JSON.stringify(data), headers: { 'Idempotency-Key': idempotencyKey } }),
  update: (id: string, content: string) =>
    authedFetch(`/v1/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
  delete: (id: string) => authedFetch(`/v1/messages/${id}`, { method: 'DELETE' }),
  react: (id: string, emoji: string) =>
    authedFetch(`/v1/messages/${id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  createTask: (id: string, data: { title: string; projectId?: string }) =>
    authedFetch(`/v1/messages/${id}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (params: { workspaceId: string; projectId?: string; status?: string; cursor?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    )
    return authedFetch(`/v1/tasks?${qs}`)
  },
  get: (id: string) => authedFetch(`/v1/tasks/${id}`),
  create: (data: Record<string, unknown>) =>
    authedFetch('/v1/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    authedFetch(`/v1/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => authedFetch(`/v1/tasks/${id}`, { method: 'DELETE' }),
}

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiApi = {
  query: (data: { question: string; workspaceId: string }) =>
    authedFetch('/v1/ai/query', { method: 'POST', body: JSON.stringify(data) }),
  summarize: (data: { entityType: string; entityId: string; workspaceId: string }) =>
    authedFetch('/v1/ai/summarize', { method: 'POST', body: JSON.stringify(data) }),
  generateTasks: (data: { content: string; workspaceId: string }) =>
    authedFetch('/v1/ai/tasks/generate', { method: 'POST', body: JSON.stringify(data) }),
}

// ─── Search ───────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (params: { q: string; workspaceId: string; types?: string[] }) => {
    const qs = new URLSearchParams({ q: params.q, workspaceId: params.workspaceId })
    if (params.types) qs.set('types', params.types.join(','))
    return authedFetch(`/v1/search?${qs}`)
  },
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  overview: (workspaceId: string) => authedFetch(`/v1/admin/${workspaceId}/overview`),
  auditLog: (workspaceId: string, cursor?: string) =>
    authedFetch(`/v1/admin/${workspaceId}/audit-log${cursor ? `?cursor=${cursor}` : ''}`),
  members: (workspaceId: string) => authedFetch(`/v1/admin/${workspaceId}/members`),
  updateMember: (workspaceId: string, userId: string, data: { role?: string; status?: string }) =>
    authedFetch(`/v1/admin/${workspaceId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeMember: (workspaceId: string, userId: string) =>
    authedFetch(`/v1/admin/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
}

// ─── Super Admin (platform-wide, no workspace context — deliberately a
// separate namespace from adminApi above) ─────────────────────────────────────
export const superAdminApi = {
  overview: () => authedFetch('/v1/super-admin/overview'),
  workspaces: (params: { cursor?: string; search?: string; plan?: string; status?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])
    return authedFetch(`/v1/super-admin/workspaces${qs.toString() ? `?${qs}` : ''}`)
  },
  workspace: (workspaceId: string) => authedFetch(`/v1/super-admin/workspaces/${workspaceId}`),
  suspendWorkspace: (workspaceId: string, reason: string) =>
    authedFetch(`/v1/super-admin/workspaces/${workspaceId}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reactivateWorkspace: (workspaceId: string) =>
    authedFetch(`/v1/super-admin/workspaces/${workspaceId}/reactivate`, { method: 'POST' }),
  changeWorkspacePlan: (workspaceId: string, plan: string) =>
    authedFetch(`/v1/super-admin/workspaces/${workspaceId}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) }),
  users: (params: { cursor?: string; search?: string; status?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])
    return authedFetch(`/v1/super-admin/users${qs.toString() ? `?${qs}` : ''}`)
  },
  user: (userId: string) => authedFetch(`/v1/super-admin/users/${userId}`),
  suspendUser: (userId: string, reason: string) =>
    authedFetch(`/v1/super-admin/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reactivateUser: (userId: string) =>
    authedFetch(`/v1/super-admin/users/${userId}/reactivate`, { method: 'POST' }),
  setSuperAdmin: (userId: string, grant: boolean) =>
    authedFetch(`/v1/super-admin/users/${userId}/super-admin`, { method: 'POST', body: JSON.stringify({ grant }) }),
  auditLog: (params: { cursor?: string; action?: string; targetWorkspaceId?: string; targetUserId?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])
    return authedFetch(`/v1/super-admin/audit-log${qs.toString() ? `?${qs}` : ''}`)
  },
}

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadApi = {
  upload: async (file: File, workspaceId: string): Promise<{ id: string; url: string; name: string; mimeType: string; size: number }> => {
    const form = new FormData()
    form.append('file', file)
    form.append('workspaceId', workspaceId)

    const headers = new Headers()
    // Bug fix: this read `localStorage.getItem('_ctkn')` — a key nothing
    // else in this app ever wrote (access tokens are deliberately kept
    // in memory only, via the accessToken variable above / this same
    // file's getAccessToken(), never persisted to localStorage — see
    // setAccessToken/clearAccessToken). That read was always null, so
    // every upload went out with no Authorization header at all and
    // would 401. The comment right here even claimed "rely on
    // authedFetch for real auth" — but this function never actually
    // called authedFetch; it's a raw fetch() because FormData needs the
    // browser's own auto-generated multipart boundary Content-Type,
    // which authedFetch's doFetch would override with
    // application/json. Fixed to use the real in-memory token via
    // getAccessToken() instead of the phantom localStorage key.
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1/upload`, {
      method: 'POST',
      headers,
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText })) as { message: string }
      throw new ApiClientError(res.status, 'UPLOAD_FAILED', err.message)
    }
    return res.json()
  },
}
