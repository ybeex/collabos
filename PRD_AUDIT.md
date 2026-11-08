# CollabOS — PRD Compliance Audit

Source: `CollabOS-PRD.html` (v1.0, June 2026, 22 sections). Every finding below cites the exact PRD claim and the exact file/line of evidence from the codebase — no claim here is asserted without a grep or read backing it. A second file, `nexus-rtc-prd.html`, describes a differently-named product ("Nexus") and was excluded from this audit as out of scope.

**Verdict in one line:** the build is faithful to the PRD's design system, security architecture, data model, and P0/P1 feature priorities almost to the letter — but two specific, named P0 architectural commitments (CRDT-based real-time editing, meeting transcription) were not built, and one file contains a comment that actively misdescribes the system as having the CRDT architecture it doesn't have.

---

## 🔴 Critical — architecture commitments not met

### 1. CRDT-based collaborative editing was not built, and one comment misrepresents this

**PRD claim** (§07, Technical Architecture): *"CRDT-First Data Layer: All collaborative content (docs, tasks, canvas) uses Conflict-Free Replicated Data Types (Automerge or Yjs) enabling true offline-first and merge-without-conflicts across all clients."* Listed as a Core Architecture Decision, and §16 specifies Yjs document state stored as `bytea` columns in PostgreSQL with S3 overflow.

**What exists:** Zero references to Yjs or Automerge anywhere in the codebase (`grep -ri "yjs\|automerge"` across all TS/TSX/JSON returns nothing). `apps/api/src/routes/docs/index.ts`, `PUT /:docId/blocks`, replaces the entire block array on every save — last-write-wins, with a version snapshot taken first for undo/history. There is no merge logic, no operational transform, no conflict resolution of any kind.

**The comment problem:** Line 190 of that same file reads `// Receives full block array — CRDT deltas handled at WS layer, HTTP is fallback`. I checked `routes/ws/index.ts` directly — there is no `crdt`, `delta`, `doc.block.updated`, or `doc.presence.updated` event anywhere in it (all four greps returned empty). The comment describes an architecture that does not exist in this codebase, in either file. This is worse than an undocumented gap — it's a false claim a future engineer would read and trust.

**Consequence for the rest of the PRD:** §13's "every URL... preserves exact state" and §14 Flow 2's live-embedded-task-in-doc claim both implicitly assume conflict-free simultaneous editing; without CRDT, two people editing the same doc block at once will silently overwrite each other, which the PRD explicitly says CollabOS solves (*"Eliminates Notion sidebar"* / *"Full offline support"* differentiator tags on this exact feature in §06).

**Fix:** Either (a) implement Yjs per the PRD's own stated preference (it's also the PRD's own §12 Q3 recommendation between the two options — "more battle-tested... better runtime performance"), or (b) if a deliberate scope decision was made to defer this, remove the misleading comment and document the actual last-write-wins behavior plainly, including its data-loss risk under concurrent edits.

---

### 2. Meeting transcription and AI meeting summaries (P0) do not exist

**PRD claim** (§06, Module 5 — CollabOS Intelligence): *"Meeting summaries — Auto-transcribe + summarize any CollabOS call. Output: decisions, action items, attendees."* Marked **P0 — Must**. §14 Flow 4 specifies the full UX: silent auto-transcription on call start, live speaker-attributed transcript, AI processing within ~30 seconds of call end, auto-posted summary to the channel. §17 specifies the exact endpoint: `POST /v1/ai/meeting/summary`.

**What exists:** `apps/api/src/routes/ai/index.ts` has exactly 3 endpoints — `/query`, `/summarize`, `/tasks/generate`. No `/meeting/summary`. `apps/web/src/components/video/call-panel.tsx` is join/leave/mic/camera state only — no recording, no transcript capture, no post-call processing of any kind. Searched the entire API for any reference to "transcri" (would match transcribe, transcription, transcript) — zero results.

**Fix:** This requires LiveKit's recording/egress capability (or a separate audio-capture pipeline) feeding a transcription service (Whisper API or similar) into a new `POST /v1/ai/meeting/summary` endpoint that mirrors the existing `/summarize` pattern. Given it's marked P0 alongside Workspace Q&A and Smart Notifications (both of which *are* built), this is the one P0 Intelligence-module feature with no implementation at all, not even a stub.

---

## 🟠 High — features marked P0/P1 with no frontend surface despite backend existing

### 3. Work Graph has a real API and zero dedicated UI — no `/graph` route exists at all

**PRD claim** (§13, URL Structure): every module gets a deep-linkable route, explicitly including `app.collabos.io/:workspace/graph/:item-id — shows any item + all its cross-layer links`. §16 calls the Work Graph *"the schema that makes cross-layer context possible"* and §21 names it as the product's primary defensible moat (*"Work Graph data network effect... a compounding moat"*).

**What exists:** `GET /v1/graph/:entityType/:entityId/links` is real and correctly implemented (`apps/api/src/routes/graph/index.ts`) — workspace-membership-filtered, single-hop edge lookup. But `find apps/web/src/app -type d` shows no `graph` directory anywhere in the route tree. The data the PRD calls the company's defensible moat has no page a user can visit to see it.

This is consistent with — and independently confirms — a finding from this session's own earlier product-management review (`FINAL_SWEEP.md`/prior audit discussion): the Work Graph is real on the backend and invisible on the frontend.

**Fix:** Build a minimal `/[workspaceSlug]/graph/[itemId]` route rendering the existing `GET /v1/graph/.../links` response as a simple node-link panel. The backend work is already done; this is purely a missing page.

### 4. Deep-linking to sub-document, sub-canvas, and sub-thread state is absent across all three modules

**PRD claim** (§13): three specific URL patterns — `/docs/:doc-id/block/:block-id`, `/canvas/:canvas-id?node=:node-id`, `/channels/:channel-id/thread/:thread-id` — each described as preserving "scroll position, selected block, active thread... no navigate-to-find-this friction."

**What exists:** Checked all three. Docs route is `[docId]` only, no block-level segment. Canvas route is `[canvasId]` only — confirmed via `grep "useSearchParams"` across the canvas components — no `?node=` handling. Channels has no `/thread/:thread-id` segment; `grep -rn "thread"` against the channels route directory returns nothing, confirming thread state is local component state (open/closed in `ThreadPanel`), not a URL.

**Fix:** Lower priority than #1–#3 since the modules themselves work — this affects shareability and bookmarking specifically, which the PRD treats as a named UX pillar but which doesn't block core daily use.

---

## 🟡 Medium — partial implementations and design-system deviations

### 5. Typography: PRD's three-typeface system (Syne / DM Mono / Fraunces) was not used; Geist Sans / Geist Mono was

**PRD claim** (§15): explicit named typefaces with weights and sizes — `Display/H1: Syne 800 48px`, `H2: Syne 700 32px`, `Body: DM Mono 400 13px`, `Subheading: Fraunces Light Italic 18px`.

**What exists:** `apps/web/src/app/layout.tsx` imports `Geist` and `Geist_Mono` from `next/font/google`. Zero references to Syne, DM Mono, or Fraunces anywhere in the codebase. The color tokens, spacing scale, and button border-radius from the same §15 design-system spec all match exactly (verified separately below) — only the typeface choice diverges.

This reads as a deliberate substitution (Geist is a comparable, well-regarded monospace/sans pairing) rather than an oversight, but it's a visible brand decision that doesn't match the documented spec.

### 6. AI features have no per-workspace LLM endpoint — "BYO LLM" (Enterprise) does not exist

**PRD claim** (§19, Security): *"Enterprise can bring their own LLM endpoint (BYO LLM)."* Also listed as an Enterprise pricing-tier line item in §20.

**What exists:** `ANTHROPIC_API_KEY` in `apps/api/src/utils/env.ts` is a single, global, deployment-wide environment variable. No per-workspace model/endpoint configuration exists anywhere in the AI routes, the workspace settings, or the schema.

### 7. GDPR data residency selection and right-to-erasure endpoint are absent

**PRD claim** (§19): *"Data residency selection at workspace creation (US/EU/APAC). Right-to-erasure API endpoint for GDPR compliance."* §19's own compliance roadmap targets this for "Month 3 (Beta)," scoped to Legal + Engineering jointly — so this is arguably not yet due per the PRD's own timeline, but it's worth recording as currently unimplemented since the audit's job is to report state, not assume intent.

**What exists:** No residency field on the Workspace model, no erasure endpoint. Confirmed via direct grep across the auth and workspace routes.

### 8. Accessibility: general ARIA coverage is good; two PRD-named requirements are specifically unmet

**PRD claim** (§08): *"Screen reader optimized with ARIA live regions for real-time updates"* and *"Reduced-motion mode for vestibular disorder users."*

**What exists:** `aria-label`/`aria-pressed`/`aria-current` usage is genuinely solid — 29 component files use these attributes, largely from the careful sweep work done earlier in this session. But `aria-live` (specifically named for real-time updates, which is the entire premise of a chat app) returns zero matches anywhere in `apps/web/src/`. `prefers-reduced-motion` also returns zero matches — no CSS media query, no React check, despite the PRD calling this out by name for vestibular-disorder users specifically.

The third accessibility claim — *"Color-blind safe (verified with Coblis simulator)"* for status badges — is partially supported in spirit: task status columns use text labels ("Done," "Blocked," "In Progress") alongside color, not color alone, which is the substantive WCAG-relevant practice. The specific simulator-verification claim isn't independently checkable from source code either way.

### 9. Onboarding has no role-selection step and no import wizard

**PRD claim** (§14, Flow 1): 5-step flow — Sign Up → Workspace Setup → **Role Selection** (PM/Dev/Designer, sets default layout) → Invite Team → **Quick Import** (Slack/Notion/CSV, skippable) → pre-populated workspace with sample doc + Kanban board + AI-generated welcome message.

**What exists:** `apps/web/src/app/new-workspace/page.tsx` → `NewWorkspaceForm` is a single name/slug form. No role-selection UI exists anywhere (`find ... -iname "*role-selection*"` returns nothing). No import wizard for Slack/Notion/CSV exists. Worth noting this isn't explicitly listed in the PRD's own Phase 1 roadmap line items (§09 lists only "Auth + Workspace provisioning" for Phase 1, without the onboarding-flow specifics), so this may be intentionally deferred rather than missed — but Flow 1 itself is presented as one of "the five flows that define the product experience," so the gap is real regardless of phase sequencing.

---

## 🟢 Correctly resolved, not gaps — open questions the PRD itself left undecided

### 10. Video calling: LiveKit chosen over Daily.co — this is a *resolved* PRD open question, not a deviation

**PRD claim** (§12, Q2 — explicitly framed as an open question): *"Build vs. Buy: Video Calling... Native video calling can use Daily.co or LiveKit (embedded WebRTC)... Recommendation: use Daily.co for Phase 1 MVP, evaluate building in-house for v2."*

**What exists:** Self-hosted LiveKit + coturn (`docker/livekit/`, `docker/coturn/`, `apps/api/src/routes/video/index.ts`). LiveKit is the PRD's own named alternative in the same sentence as its non-binding recommendation. This is the kind of build-vs-buy decision §12 explicitly says was still open at PRD sign-off — correctly resolved, not a compliance gap.

### 11. AI Agents (P2) and Neo4j (optional, Phase 2) — correctly absent

Both are explicitly lower-priority or optional in the PRD itself (§06 marks AI Agents "P2 — Nice"; §16 marks Neo4j "optional, Phase 2," with PostgreSQL recursive CTEs as the Phase 1 default). Neither was built. The Automations engine (if/then rules, marked P1 "Should") *was* built as the PRD's own simpler P1 substitute for full agentic AI Agents — this is exactly the prioritization the PRD's own P0/P1/P2 tagging would predict, not a gap.

---

## ✅ Verified faithful — exact matches, not approximations

Worth recording with the same rigor as the gaps, since "audit" means checking both directions:

- **Color tokens** (§15): every hex value checked — `--ink #0d0d0d`, `--paper #f5f0e8`, `--accent #e8400a`, `--success #1a7a45`, `--warning #d46000`, `--error #c0301a`, `--info #1a4fff` — matches character-for-character in `apps/web/src/styles/globals.css`, including light/dark mode token swaps.
- **Rate limits** (§17): Free 60 req/min and Pro 600 req/min match exactly in `apps/api/src/utils/env.ts`. (Enterprise is "custom" per PRD, correctly left as a configurable default rather than hardcoded.)
- **JWT token lifetimes** (§19): 15-minute access tokens, 30-day rotating refresh tokens — matches the actual auth implementation audited in this session's earlier passes.
- **Cursor-based pagination, Idempotency-Key headers, webhook event model** (§17): all three API design principles are genuinely implemented as specified, not just claimed.
- **Work Graph edge type vocabulary** (§16): `converted_from`, `referenced_in`, `mentioned_in`, `decided_in` all appear as real, used values in the actual Prisma schema and route logic — not just names copied from the PRD into comments.
- **RBAC hierarchy** (§19): Owner → Admin → Member → Guest exactly matches the implemented `requireRole` hierarchy from this session's earlier middleware work (External is the one PRD-named tier not present, but the PRD's own §19 doesn't elaborate what External would mean beyond naming it, making it unclear whether it was meant to ship in v1 scope at all).
- **Self-hosted, free-tier-first infrastructure philosophy**: while the PRD's stack recommendation (§07) names AWS/Cloudflare Workers/Auth0/Clerk specifically, the actual build chose self-hosted equivalents throughout (Postgres+pgvector, Redis, MinIO/R2, self-rolled JWT auth) — a defensible, even more aggressive interpretation of cost-consciousness than the PRD specified, surfaced and explicitly requested in this session's own infrastructure work rather than a silent substitution.

---

## Summary table

| # | Finding | Severity | PRD §  | Status |
|---|---|---|---|---|
| 1 | CRDT editing not built; misleading comment claims it exists | 🔴 Critical | §07, §16 | Gap + false comment |
| 2 | Meeting transcription/summary (P0) entirely absent | 🔴 Critical | §06, §14, §17 | Gap |
| 3 | Work Graph has no frontend route | 🟠 High | §13 | Gap (backend exists) |
| 4 | No sub-resource deep-linking (docs/canvas/threads) | 🟠 High | §13 | Gap |
| 5 | Typography uses Geist, not Syne/DM Mono/Fraunces | 🟡 Medium | §15 | Deviation |
| 6 | No BYO LLM for Enterprise | 🟡 Medium | §19, §20 | Gap |
| 7 | No GDPR residency/erasure endpoint | 🟡 Medium | §19 | Gap (not yet due per roadmap) |
| 8 | No `aria-live`, no `prefers-reduced-motion` | 🟡 Medium | §08 | Partial — general a11y is solid |
| 9 | No role-selection or import-wizard onboarding | 🟡 Medium | §14 | Gap (not in Phase 1 line items) |
| 10 | LiveKit vs. Daily.co | ✅ Resolved | §12 Q2 | Correctly resolved open question |
| 11 | No AI Agents, no Neo4j | ✅ Correct | §06, §16 | Correctly deferred per P2/optional tags |
| — | Color tokens, rate limits, JWT lifetimes, pagination, edge types, RBAC | ✅ Verified | §15,17,19,16 | Exact matches |
