# CollabOS — PRD Fix Continuation Plan

**Status: 7 of 9 fixable findings complete and verified.** Findings #10 and #11 were excluded per your original instruction (already-resolved: LiveKit vs. Daily.co, AI Agents/Neo4j deferral).

This bundle (`collabos-prd-fixes-final`) is a fully verified checkpoint — every `.ts`/`.tsx` file in the codebase passed a brace-balance sweep with zero failures, and every completed finding was individually spot-checked against its actual file content before packaging. Two findings remain, described below with enough detail to implement directly.

---

## ✅ Complete (Findings #1–#7)

| # | Finding | What was built |
|---|---|---|
| 1 | CRDT editing | Real Yjs sync: `DocumentYjsState` model, `services/yjs-sync.ts` (server-side sync protocol, debounced persistence, S3 overflow), `hooks/use-doc-crdt-sync.ts` (client), wired into `doc-view.tsx`. The misleading "CRDT deltas handled at WS layer" comment now describes reality. |
| 2 | Meeting transcription | `CallTranscript`/`CallTranscriptSegment` models, Web Speech API capture (`hooks/use-transcript-capture.ts`, Chromium-only — stated honestly in the UI), `POST /v1/ai/meeting/summary`, async job handler with decision/action-item extraction, wired into call join/leave lifecycle. |
| 3 | Work Graph frontend | `/[workspaceSlug]/graph/[itemId]` route, real dynamic radial-layout `GraphView` component, backend edge enrichment (human-readable titles/excerpts), "View full Work Graph" link added to task detail drawer. |
| 4 | Deep-linking | `?block=` (docs, with scroll+highlight), `?node=` (canvas, with pan-to-center), `?thread=` (channels) — plus a genuinely new backend endpoint `GET /v1/threads/:threadId` that didn't exist before (needed to resolve a thread ID to its parent message). |
| 5 | Typography | Syne/DM Mono/Fraunces via `next/font/google`, replacing Geist. **Side discovery:** `--font-syne` was referenced by Tailwind config but never defined — 14 components were silently falling back to `system-ui`. Fixed as part of this change. |
| 6 | BYO LLM | `LLMOverride` param on `callAnthropic`, `services/workspace-llm-config.ts` resolver, encrypted storage in `Workspace.settings.llm`, admin-gated `PUT/GET /v1/workspaces/:id/llm-config` (Enterprise-only). **Wired into all 4 call sites** — verified via `grep` that zero `callAnthropic()` calls remain without the override parameter. |
| 7 | GDPR | `DataResidency` enum + field (honestly scoped — recorded, not data-plane-enforced in this single-region deployment, stated explicitly in code comments), `ErasureRequest` model, `POST /v1/auth/me/erasure-request` (password-confirmed, anonymizes rather than hard-deletes to preserve other users' referential content). **Also fixed:** a severe pre-existing bug where a stray closing brace after `GET /me` was silently orphaning 5 routes (`forgot-password`, `reset-password`, `PATCH /me`, `sso/exchange`, and the new erasure endpoint) outside the `authRoutes` function scope — a hard compile error waiting to happen, unrelated to any of this session's edits, found while debugging an unrelated brace issue. |

All migrations (`0001`–`0006`) are present and in order. Run `npx prisma migrate deploy` (or `migrate dev` locally) before starting the API.

---

## ⏳ Remaining: Finding #8 — Accessibility

**PRD §08:** *"Screen reader optimized with ARIA live regions for real-time updates"* and *"Reduced-motion mode for vestibular disorder users."*

### Part A — `aria-live` region (design already decided, not yet re-applied after a reset)

In `apps/web/src/components/channels/channel-view.tsx`:

1. Add state: `const [liveAnnouncement, setLiveAnnouncement] = useState('')`
2. In `handleWsEvent`'s `message.created` branch, in the `else` (not-near-bottom) path where `setShowNewMessagesPill(true)` already fires, add alongside it:
   ```tsx
   const msg = event.data as Message
   const preview = msg.content.length > 60 ? `${msg.content.slice(0, 60)}…` : msg.content
   setLiveAnnouncement(`New message from ${msg.author.name}: ${preview}`)
   ```
3. In `scrollToBottom`, add `setLiveAnnouncement('')` alongside the existing `setShowNewMessagesPill(false)`.
4. In the JSX, as the first child of the outermost `<div>`:
   ```tsx
   <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
     {liveAnnouncement}
   </div>
   ```

**Design rationale (already settled — don't re-litigate):** announcing every single message would be worse than silence for a screen reader user in an active channel. The live region only fires when the *visible* "New messages" pill would also appear (i.e., user scrolled away from bottom) — same signal, right channel for how the person is using the app. `sr-only` is already a working Tailwind core utility in this codebase (confirmed in use across 6 other files — `search-modal.tsx`, `command-palette.tsx`, the super-admin views, marketing pages).

Apply the same pattern to `notifications-view.tsx` and `notification-bell.tsx` for new-notification announcements — not yet started, same design.

### Part B — `prefers-reduced-motion` (not started)

In `apps/web/src/styles/globals.css`, add a global media query near the top:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This is the standard, comprehensive approach — it catches every `animate-*` Tailwind utility and every custom `@keyframes` (the marquee/blink/slide-down/slide-up ones from earlier sessions, plus anything in the marketing SVGs) without needing to touch each component individually. Verify after adding: `grep -n "@keyframes" apps/web/src/styles/globals.css` to confirm the full list this override needs to cover, and spot-check that `scroll-behavior: smooth` calls in JS (`scrollIntoView({ behavior: 'smooth' })`, used in `channel-view.tsx` and `doc-view.tsx`) — those are JS-driven, not CSS, so the media query above won't catch them. For full compliance, gate those too:

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' })
```

Apply to the `scrollIntoView` calls in `channel-view.tsx` (2 call sites: the WS handler and `scrollToBottom`) and `doc-view.tsx` (the block-deep-link effect).

---

## ⏳ Remaining: Finding #9 — Onboarding

**PRD §14 Flow 1:** 5-step flow — Sign Up → Workspace Setup → **Role Selection** (PM/Dev/Designer, sets default layout) → Invite Team → **Quick Import** (Slack/Notion/CSV, skippable) → pre-populated workspace.

Not started at all this session. Scope honestly: this is the largest remaining piece, genuinely comparable in size to Finding #2 (meeting transcription) or #6 (BYO LLM) — budget accordingly, don't treat it as a quick add-on.

**Suggested build order:**

1. **Role field.** Add `onboardingRole: String?` to `User` (values: `pm` | `dev` | `designer`, nullable — existing users have none). Migration `0007`.
2. **Role selection step.** New component in the existing `new-workspace` flow (`apps/web/src/app/new-workspace/` / `components/workspace/new-workspace-form.tsx`) — a simple 3-card selector, PATCH `/v1/auth/me` with the choice (that endpoint already exists and already accepts partial updates).
3. **"Sets default layout"** — the PRD's own phrasing implies this affects which module a user lands on by default. Cheapest honest implementation: store the role, and have the post-onboarding redirect target `/[workspaceSlug]/tasks` for PM, `/[workspaceSlug]/channels` for Dev, `/[workspaceSlug]/canvas` for Designer, instead of the current unconditional `/channels` redirect (check `apps/web/src/app/(workspace)/[workspaceSlug]/page.tsx` for that logic). Don't over-build this into a full customizable-layout system — the PRD line is thin on specifics, and a sensible default-landing-page mapping honestly satisfies "sets default layout" without inventing scope the PRD didn't ask for.
4. **Import wizard (Slack/Notion/CSV).** This is the genuinely large piece. Recommend scoping to **CSV only** for a first pass — Slack/Notion each need real OAuth app registration and their own API integration work that's a separate, much larger undertaking (comparable to the video/LiveKit build). A CSV importer (columns: channel name, message text, author email, timestamp → bulk-insert via the existing `messages`/`channels` creation logic) is buildable in the same session-sized scope as the other findings. Document the Slack/Notim deferral explicitly in a code comment the same way the Web Speech API scope was documented for Finding #2 — state plainly what's built and what a full implementation would additionally require, rather than silently under-delivering against the PRD's named integrations.
5. **Skip path.** PRD says "skippable" — make sure every step in this flow has a visible skip/later option, since forcing onboarding steps is a common real-world UX complaint the PRD is explicitly guarding against.

---

## Before deploying any of this

- Run `npm install` in `apps/api` and `apps/web` — `yjs`, `lib0` (API) and `yjs` (web) were added to `package.json` but never actually installed in this sandboxed environment.
- Run the new migrations: `npx prisma migrate deploy` from `packages/db`.
- Set `ENCRYPTION_KEY` in production if not already set — both webhook secrets (earlier session) and now BYO LLM API keys depend on it; `PUT /llm-config` will throw clearly if it's missing rather than silently storing plaintext, but it's worth confirming before an admin hits that error live.
- The Yjs multi-replica limitation is documented in `services/yjs-sync.ts` — a document's live collaborative session only works correctly on a single API replica. If running the 2-replica production compose from earlier sessions, either configure sticky routing for `/v1/ws/doc/*` at the nginx layer or accept this as a known limitation for now.
