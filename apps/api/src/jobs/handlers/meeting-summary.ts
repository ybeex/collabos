/**
 * PRD_AUDIT.md Finding #2: processes a completed call transcript into a
 * summary with extracted decisions and action items, closing the gap
 * where meeting summaries (marked P0 in PRD §06) did not exist in any
 * form. Reuses the exact same response schema as the existing
 * POST /v1/ai/summarize endpoint (summary/decisions/actions/
 * openQuestions), for consistency across every AI summarization surface.
 */
import type { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { logger } from '../../utils/logger.js'
import { callAnthropic } from '../../services/anthropic.js'
import { resolveWorkspaceLlmOverride } from '../../services/workspace-llm-config.js'
import { env } from '../../utils/env.js'

interface MeetingSummaryJob {
  transcriptId: string
  channelId: string
  workspaceId: string
}

interface ParsedSummary {
  summary: string
  decisions: string[]
  actions: Array<{ task: string; owner: string | null }>
}

// A job handler runs outside any Fastify request context, so there's no
// app.redis decorator to reach for. This is a small, dedicated
// publish-only connection to the MAIN app Redis (env.REDIS_URL) —
// deliberately not the separate queue Redis (env.REDIS_QUEUE_URL) that
// jobs/queues/index.ts's `connection` object points at, since WS pub/sub
// (routes/ws/index.ts) subscribes on the main Redis, not the queue one.
let publishClient: Redis | null = null
const getPublishClient = (): Redis => {
  if (!publishClient) {
    publishClient = new Redis(env.REDIS_URL, { tls: env.REDIS_TLS ? {} : undefined })
  }
  return publishClient
}

export const processMeetingSummary = async (
  job: Record<string, unknown>,
  db: PrismaClient,
): Promise<void> => {
  // Bug fix (found via tsc): same 'convert to unknown first' pattern as
  // jobs/queues/worker-registry.ts's cast the other direction — this
  // project's local {}Job interfaces are closed shapes that don't
  // structurally overlap with Record<string, unknown> under strict mode.
  const { transcriptId, channelId, workspaceId } = job as unknown as MeetingSummaryJob

  const segments = await db.callTranscriptSegment.findMany({
    where: { transcriptId },
    orderBy: { spokenAt: 'asc' },
  })

  if (segments.length === 0) {
    logger.info({ transcriptId }, 'Meeting transcript has no segments — nothing to summarize')
    // Still mark as summarized so GET /v1/ai/meeting/summary/:id doesn't
    // poll forever for a call where nobody's browser captured any speech
    // (Web Speech API capture is Chromium-only).
    await db.callTranscript.update({
      where: { id: transcriptId },
      data: {
        summary: 'No transcript was captured for this call.',
        decisions: [],
        actionItems: [],
        summarizedAt: new Date(),
      },
    })
    return
  }

  const transcriptText = segments.map((s) => `${s.speakerName}: ${s.text}`).join('\n')

  const systemPrompt = `You are a precise summarizer for a team collaboration tool, processing a meeting transcript.
Respond ONLY with valid JSON matching this schema exactly:
{
  "summary": "2-3 sentence plain text summary of what was discussed",
  "decisions": ["decision 1", "decision 2"],
  "actions": [{ "task": "action description", "owner": "person name mentioned as responsible, or null" }],
  "openQuestions": ["unresolved question 1"]
}
Base owner names only on what's explicitly said in the transcript — never guess or infer who owns an action item if it wasn't stated.`

  let parsed: ParsedSummary

  try {
    // PRD_AUDIT.md Finding #6: a meeting held in a BYO-LLM-configured
    // Enterprise workspace should have its summary generated via that
    // workspace's configured endpoint, not silently fall back to the
    // global key — same resolver used by every other AI call site.
    const llmOverride = await resolveWorkspaceLlmOverride(db, workspaceId)
    const raw = await callAnthropic(systemPrompt, transcriptText, 800, llmOverride)
    const cleaned = JSON.parse(raw.replace(/```json|```/g, '').trim()) as {
      summary?: string
      decisions?: string[]
      actions?: Array<{ task: string; owner: string | null }>
    }
    parsed = {
      summary: cleaned.summary ?? 'Summary unavailable.',
      decisions: cleaned.decisions ?? [],
      actions: cleaned.actions ?? [],
    }
  } catch (err) {
    logger.error({ err, transcriptId }, 'Failed to generate meeting summary via Anthropic')
    parsed = {
      summary: 'Automatic summarization failed for this call. The raw transcript is still available.',
      decisions: [],
      actions: [],
    }
  }

  await db.callTranscript.update({
    where: { id: transcriptId },
    data: {
      summary: parsed.summary,
      decisions: parsed.decisions,
      actionItems: parsed.actions,
      summarizedAt: new Date(),
    },
  })

  // PRD §14 Flow 4: "auto-posted summary to the channel."
  //
  // NOTE on channel naming: messages/index.ts and video/index.ts both
  // publish to `ws:channel:${channelId}`, which looks like the
  // established convention — but routes/ws/index.ts's connection handler
  // only ever subscribes to `ws:workspace:${workspaceId}` and
  // `ws:user:${userId}`. There is no `ws:channel:*` subscription
  // anywhere in that file, meaning `ws:channel:*` publishes appear to be
  // a pre-existing, separate bug predating this fix — out of scope for
  // the PRD audit task at hand, but not something to knowingly copy into
  // new code. Publishing on the workspace channel instead, which IS
  // subscribed to, with channelId included in the payload for the
  // frontend to filter on.
  const redis = getPublishClient()
  await redis.publish(
    `ws:workspace:${workspaceId}`,
    JSON.stringify({
      event: 'meeting.summary_ready',
      data: { transcriptId, channelId, workspaceId, summary: parsed.summary },
    }),
  )

  logger.info({ transcriptId, decisionsCount: parsed.decisions.length, actionsCount: parsed.actions.length }, 'Meeting summary generated')
}
