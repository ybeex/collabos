import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ForbiddenError, ServiceUnavailableError } from '../../utils/errors.js'
import { env } from '../../utils/env.js'
import { CACHE_TTL } from '../../plugins/cache.js'
import { callAnthropic } from '../../services/anthropic.js'
import { resolveWorkspaceLlmOverride } from '../../services/workspace-llm-config.js'
import crypto from 'node:crypto'

const querySchema = z.object({
  question: z.string().min(1).max(1000).trim(),
  workspaceId: z.string().min(1),
  contextTypes: z.array(z.enum(['message', 'task', 'document', 'canvas'])).optional(),
})

const summarizeSchema = z.object({
  entityType: z.enum(['channel', 'document', 'task_list', 'meeting_transcript']),
  entityId: z.string().min(1),
  workspaceId: z.string().min(1),
})

const generateTasksSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
})

export const aiRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── POST /v1/ai/query ─────────────────────────────────────────────
  // Cross-workspace natural language Q&A
  app.post('/query', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const body = querySchema.parse(req.body)
      const userId = req.user.sub

      if (!env.ENABLE_AI) throw new ServiceUnavailableError('AI features require a Pro plan')

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      // Cache key for identical questions
      const questionHash = crypto
        .createHash('sha256')
        .update(`${body.workspaceId}:${body.question}`)
        .digest('hex')
        .slice(0, 16)

      const cacheKey = `ai:query:${questionHash}`
      const cached = await app.redis.get(cacheKey)
      if (cached) {
        reply.header('X-Cache', 'HIT')
        return JSON.parse(cached)
      }

      // Gather context from workspace (last 7 days)
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const types = body.contextTypes ?? ['message', 'task', 'document']

      const [messages, tasks, docs] = await Promise.all([
        types.includes('message')
          ? app.db.message.findMany({
              where: {
                channel: { workspaceId: body.workspaceId },
                createdAt: { gte: since },
                deletedAt: null,
              },
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: {
                content: true, createdAt: true,
                author: { select: { name: true } },
                channel: { select: { name: true } },
              },
            })
          : Promise.resolve([]),

        types.includes('task')
          ? app.db.task.findMany({
              where: { workspaceId: body.workspaceId, deletedAt: null },
              orderBy: { updatedAt: 'desc' },
              take: 30,
              select: { title: true, status: true, assignee: { select: { name: true } }, dueDate: true },
            })
          : Promise.resolve([]),

        types.includes('document')
          ? app.db.document.findMany({
              where: { workspaceId: body.workspaceId, deletedAt: null },
              orderBy: { updatedAt: 'desc' },
              take: 10,
              select: { title: true, updatedAt: true },
            })
          : Promise.resolve([]),
      ])

      const contextParts: string[] = []

      if (messages.length > 0) {
        contextParts.push(
          'RECENT MESSAGES:\n' +
          messages
            .map((m) => `[#${m.channel.name}] ${m.author.name}: ${m.content}`)
            .join('\n'),
        )
      }

      if (tasks.length > 0) {
        contextParts.push(
          'TASKS:\n' +
          tasks
            .map((t) => `- [${t.status}] ${t.title}${t.assignee ? ` (assigned: ${t.assignee.name})` : ''}`)
            .join('\n'),
        )
      }

      if (docs.length > 0) {
        contextParts.push(
          'DOCUMENTS:\n' +
          docs.map((d) => `- ${d.title} (updated: ${d.updatedAt.toLocaleDateString()})`).join('\n'),
        )
      }

      const systemPrompt = `You are CollabOS Intelligence, an AI assistant for a collaborative workspace.
You answer questions about the team's work based on the provided context.
Always cite your sources (e.g., "According to the message in #engineering on [date]...").
If you cannot find the answer in the context, say so clearly.
Be concise and actionable. Today is ${new Date().toLocaleDateString()}.`

      const userMessage = `Context:\n${contextParts.join('\n\n')}\n\nQuestion: ${body.question}`

      // PRD_AUDIT.md Finding #6: resolves this workspace's BYO LLM
      // config, if any — falls back to the global ANTHROPIC_API_KEY when
      // none is configured, so this is a no-op for every workspace not
      // on Enterprise or not using the feature.
      const llmOverride = await resolveWorkspaceLlmOverride(app.db, body.workspaceId)
      const answer = await callAnthropic(systemPrompt, userMessage, 1000, llmOverride)

      const response = {
        answer,
        contextUsed: {
          messages: messages.length,
          tasks: tasks.length,
          documents: docs.length,
        },
        generatedAt: new Date().toISOString(),
      }

      // Cache for 5 minutes
      await app.redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(response))

      reply.status(200)
      return response
    },
  })

  // ─── POST /v1/ai/summarize ─────────────────────────────────────────
  app.post('/summarize', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const body = summarizeSchema.parse(req.body)
      const userId = req.user.sub

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      let contentToSummarize = ''

      if (body.entityType === 'channel') {
        const messages = await app.db.message.findMany({
          where: {
            channelId: body.entityId,
            deletedAt: null,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: {
            content: true, createdAt: true,
            author: { select: { name: true } },
          },
        })
        contentToSummarize = messages
          .map((m) => `${m.author.name} (${m.createdAt.toLocaleTimeString()}): ${m.content}`)
          .join('\n')
      } else if (body.entityType === 'task_list') {
        const tasks = await app.db.task.findMany({
          where: { projectId: body.entityId, deletedAt: null },
          include: { assignee: { select: { name: true } } },
        })
        contentToSummarize = tasks
          .map((t) => `[${t.status}] ${t.title}${t.assignee ? ` — ${t.assignee.name}` : ''}`)
          .join('\n')
      } else if (body.entityType === 'document') {
        // PRD_AUDIT.md sweep fix: 'document' was declared in summarizeSchema's
        // enum but had no handling branch here — silently fell through to
        // the empty-content early return below.
        const doc = await app.db.document.findUnique({
          where: { id: body.entityId, deletedAt: null },
          select: {
            title: true,
            blocks: {
              where: { deletedAt: null },
              orderBy: { order: 'asc' },
              take: 500,
              select: { content: true },
            },
          },
        })
        if (doc) {
          const blockText = doc.blocks
            .map((b) => (b.content as { text?: string }).text ?? '')
            .filter(Boolean)
            .join('\n')
          contentToSummarize = `${doc.title}\n\n${blockText}`
        }
      } else if (body.entityType === 'meeting_transcript') {
        // PRD_AUDIT.md Finding #2: was also declared with no handling
        // branch — now backed by the real CallTranscript/
        // CallTranscriptSegment models.
        const transcript = await app.db.callTranscript.findUnique({
          where: { id: body.entityId },
          include: { segments: { orderBy: { spokenAt: 'asc' } } },
        })
        if (transcript) {
          contentToSummarize = transcript.segments
            .map((s) => `${s.speakerName}: ${s.text}`)
            .join('\n')
        }
      }

      if (!contentToSummarize) {
        return { summary: 'No content available to summarize.', decisions: [], actions: [] }
      }

      const systemPrompt = `You are a precise summarizer for a team collaboration tool.
Respond ONLY with valid JSON matching this schema exactly:
{
  "summary": "2-3 sentence plain text summary",
  "decisions": ["decision 1", "decision 2"],
  "actions": [{ "task": "action description", "owner": "person name or null" }],
  "openQuestions": ["unresolved question 1"]
}`

      const llmOverride = await resolveWorkspaceLlmOverride(app.db, body.workspaceId)
      const raw = await callAnthropic(systemPrompt, contentToSummarize, 800, llmOverride)

      let parsed: unknown
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      } catch {
        parsed = { summary: raw, decisions: [], actions: [], openQuestions: [] }
      }

      reply.status(200)
      return parsed
    },
  })

  // ─── POST /v1/ai/tasks/generate ────────────────────────────────────
  app.post('/tasks/generate', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const body = generateTasksSchema.parse(req.body)
      const userId = req.user.sub

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      const systemPrompt = `Extract actionable tasks from the given text.
Respond ONLY with valid JSON array matching this schema exactly (no markdown, no preamble):
[
  {
    "title": "Clear task title under 100 chars",
    "priority": "urgent|high|medium|low",
    "assigneeName": "person name if mentioned or null",
    "dueDate": "ISO date string if mentioned or null",
    "notes": "any additional context"
  }
]
Maximum 20 tasks. Only include concrete actionable items.`

      const llmOverride = await resolveWorkspaceLlmOverride(app.db, body.workspaceId)
      const raw = await callAnthropic(systemPrompt, body.content, 1000, llmOverride)

      let tasks: unknown[]
      try {
        tasks = JSON.parse(raw.replace(/```json|```/g, '').trim()) as unknown[]
      } catch {
        tasks = []
      }

      reply.status(200)
      return { tasks, count: tasks.length }
    },
  })

  // ─── POST /v1/ai/meeting/summary ───────────────────────────────────
  // PRD_AUDIT.md Finding #2: this exact endpoint path is specified in
  // PRD §17 and was entirely absent. Triggers async summarization of a
  // call transcript. Returns immediately with a job acceptance, matching
  // PRD §14 Flow 4's async "summary appears within ~30 seconds"
  // expectation.
  app.post('/meeting/summary', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const body = z.object({
        transcriptId: z.string().min(1),
        workspaceId: z.string().min(1),
      }).parse(req.body)
      const userId = req.user.sub

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: body.workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      const transcript = await app.db.callTranscript.findUnique({
        where: { id: body.transcriptId },
        select: { id: true, channelId: true, summarizedAt: true },
      })
      if (!transcript) throw new ServiceUnavailableError('Transcript not found')
      if (transcript.summarizedAt) {
        reply.status(200)
        return { message: 'Already summarized', transcriptId: transcript.id }
      }

      const { enqueueMeetingSummary } = await import('../../jobs/queues/index.js')
      await enqueueMeetingSummary({
        transcriptId: transcript.id,
        channelId: transcript.channelId,
        workspaceId: body.workspaceId,
      })

      reply.status(202)
      return { message: 'Summary processing started', transcriptId: transcript.id }
    },
  })

  // ─── GET /v1/ai/meeting/summary/:transcriptId ──────────────────────
  app.get('/meeting/summary/:transcriptId', {
    handler: async (req) => {
      const { transcriptId } = req.params as { transcriptId: string }
      const userId = req.user.sub

      const transcript = await app.db.callTranscript.findUnique({
        where: { id: transcriptId },
        include: { channel: { select: { workspaceId: true } } },
      })
      if (!transcript) throw new ServiceUnavailableError('Transcript not found')

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: transcript.channel.workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      return {
        transcriptId: transcript.id,
        ready: !!transcript.summarizedAt,
        summary: transcript.summary,
        decisions: transcript.decisions,
        actionItems: transcript.actionItems,
        summarizedAt: transcript.summarizedAt,
      }
    },
  })
}
