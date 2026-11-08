# CollabOS — Final Bugs & Security Sweep

Scope: the super admin dashboard feature end-to-end, and its interaction points with fixes from the prior audit (rate limiting, `requireRole`, WebSocket suspension enforcement, auth session handling). Every finding below was verified by reading the actual source — no claim here is inferred from memory of what was *intended*.

Three real, reportable issues. Several things I traced carefully and ruled out are noted at the end so the ruling-out is auditable too, not just asserted.

---

## 🟠 BUG-1 — Super admin's personal plan field gates their own dashboard rate limit

**Files:** `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/super-admin/index.ts`

`superAdminRoutes` registers `app.addHook('preHandler', app.authenticate)` at the plugin's top level, which makes `authMiddleware` run on every route in the file. `authMiddleware` — per the fix from the prior audit's BUG-7 — calls `RateLimitService.checkAndIncrement(user.sub, plan, route)` using whatever `plan` is on the JWT claim, which is the user's **personal workspace billing plan** (`free`/`pro`/`business`/`enterprise`).

Super admin authority has no relationship to a user's personal plan — nothing prevents (and nothing in the grant flow checks) granting super admin to a `free`-tier account. That account would be capped at 60 requests/minute platform-wide while trying to manage an incident — search workspaces, review the audit log, suspend something — and would receive hard `429 RATE_LIMIT_EXCEEDED` rejections from `RateLimitError`, which `authMiddleware` explicitly re-throws rather than swallowing.

The rate-limit tiers were designed to gate *workspace API usage by paying customers*; this feature accidentally inherited that gate for an unrelated trust tier. The seeded super admin (`dana@collabos.io`) happens to be `enterprise` plan, which is why this doesn't surface in the default seed data — but it's a landmine for the first real deployment that grants super admin to anyone not already on the top plan.

**Fix:** Skip the rate-limit check in `authMiddleware` when `user.isSuperAdmin` is true, or give super-admin routes their own, separately-configured limit independent of personal plan.

---

## 🟠 BUG-2 — Workspace plan change has no confirmation step, unlike every other destructive action in the same view

**File:** `apps/web/src/components/super-admin/workspaces-view.tsx`

The plan `<select>` dropdown fires `changePlan.mutate(...)` directly on `onChange` — a single click on an adjacent option changes a customer's billing tier immediately, no confirmation, no undo. Every *other* action in this same component (`Suspend`) goes through `ConfirmActionDialog`, which requires a typed, audit-logged reason before proceeding — specifically built to prevent exactly this class of accidental-click mistake.

The severity is inverted from what the UI implies: suspend is fully reversible via "Reactivate" and gets the heavyweight confirmation; a plan change has real billing and customer-trust consequences (an accidental downgrade or upgrade) and gets none. This wasn't an oversight in building the confirmation pattern — it's that the pattern was applied to the action that *looked* most dangerous rather than the one that actually carries the most consequence.

**Fix:** Route plan changes through `ConfirmActionDialog` (with `requireReason: false` is fine, given the backend already logs `fromPlan`/`toPlan` in metadata — but it still needs an explicit confirm click before the mutation fires).

---

## 🟡 BUG-3 — "Back to workspace" link is mislabeled for every user; doesn't go to a workspace

**Files:** `apps/web/src/components/super-admin/super-admin-nav.tsx`, `apps/web/src/app/page.tsx`

The link reads `href="/"` with the label "Back to workspace." `app/page.tsx` unconditionally renders the marketing homepage (`MarketingHome`) with no authentication check or redirect logic at all — there is no code path anywhere in `page.tsx` that sends an authenticated user to their workspace.

Clicking this from the dashboard takes a logged-in super admin to the public marketing landing page, complete with a "Start free" signup call-to-action as if they were a logged-out visitor — not back to any workspace, regardless of how many workspaces that super admin belongs to. For the seeded super admin, who deliberately belongs to zero workspaces by design, there's no workspace to "go back to" in the first place, which makes the mislabeling doubly apparent.

**Fix:** Either give `/` real auth-aware redirect logic (authenticated → most recent workspace, unauthenticated → marketing home), or point this specific link at something that actually resolves to a workspace context (e.g. the user's first workspace membership, falling back to `/new-workspace` if they have none).

---

## Traced and ruled out (verified safe, not just assumed)

These were checked carefully because they looked suspicious on first read. Recording why each is fine, so the audit's negative results are as inspectable as its positive ones.

- **Force-disconnect vs. normal close-handler race** (`routes/ws/index.ts`) — when `forceDisconnectWorkspace` calls `socket.close()` on every client in a suspended workspace, the existing per-connection `close` handler still fires afterward. Traced the sequence: `Set.delete()` on an already-`.clear()`'d Set is a safe no-op, and the per-connection Redis `subscriber.unsubscribe()/.quit()` cleanup is untouched by the force-disconnect path, so there's no double-cleanup and no leaked Redis connection.
- **`clients` Map entry replacement** — confirmed `clients.set(workspaceId, new Set())` only ever happens once per workspace (guarded by `clients.has`), with every subsequent operation mutating that same Set instance. No stale-reference risk between `forceDisconnectWorkspace` and the connect/close handlers.
- **Coverage of `requireSuperAdminVerified` across mutation routes** — cross-referenced all 6 `app.post`/`app.patch` calls in `routes/super-admin/index.ts` against all 6 `preHandler: [requireSuperAdminVerified]` instances. Exact 1:1 match, no destructive route is missing the strict re-verified check.
- **`requireSuperAdmin`/`requireSuperAdminVerified` themselves** — both read `isSuperAdmin` directly from the JWT claim or a fresh DB query respectively; neither depends on any separately-populated cache the way the frontend guard does, so there's no analogous staleness gap on the backend side.
- **Audit log metadata rendering** (`audit-log-view.tsx`) — `JSON.stringify(entry.metadata, null, 2)` is rendered inside a JSX text expression, never via `dangerouslySetInnerHTML`. React auto-escapes this, so arbitrary content in a typed suspension reason (which flows into metadata) cannot execute as HTML/script even if someone tried.
- **`SuperAdminAuditLog` schema** — confirmed it has zero `@relation` fields, by design, so it needed no back-relations added to `User` or `Workspace` and carries no risk of a dangling-reference schema error.

## Noted but not elevated to a numbered bug

**`SuperAdminGuard`'s reliance on persisted `user` rather than re-fetching it.** `refresh()` only sets `refreshToken`/`isAuthenticated`/`hasCheckedSession` — it never repopulates `user`. The guard's `isSuperAdmin` check therefore depends entirely on `user` having survived from a previous `login()` call in this browser's `localStorage`. Traced every code path that nulls `user` in `auth.ts`: all three null `refreshToken` in the same call, so within this file the two are never split. This makes the gap latent rather than currently reachable through any flow I could find — but it's still a correctness dependency worth closing, since a future change (or a multi-tab `logout()`/`refresh()` race) could split them. Recommend `refresh()` fetch `/v1/auth/me` (already returns `isSuperAdmin`, fixed in the prior session) rather than relying on `user` having been set by an unrelated, earlier call.
