import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { enqueueEmail } from '../../jobs/queues/index.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { CacheService, cacheKeys, CACHE_TTL } from '../../plugins/cache.js'
import { withIdempotency } from '../../utils/idempotency.js'
import { encrypt } from '../../utils/encryption.js'

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).trim(),
  description: z.string().max(500).optional(),
  // PRD_AUDIT.md Finding #7: PRD §19 "Data residency selection at
  // workspace creation (US/EU/APAC)." Recorded honestly, not enforced at
  // the data-plane level in this single-region deployment.
  dataResidency: z.enum(['us', 'eu', 'apac']).default('us'),
})

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  settings: z.record(z.unknown()).optional(),
})

const inviteMemberSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(['member', 'admin']).default('member'),
})

// PRD_AUDIT.md Finding #9: onboarding's Quick Import step, CSV path.
// CONTINUATION_PLAN.md scoped this to CSV-only for a first pass — Slack
// and Notion each need real OAuth app registration and their own API
// integration, which is separate, much larger work (comparable in size
// to the LiveKit video build) and explicitly deferred, not silently
// dropped. Row shape matches the plan: channel name, message text,
// author email, timestamp.
const csvImportRowSchema = z.object({
  channelName: z.string().min(1).max(80).trim(),
  authorEmail: z.string().email().toLowerCase(),
  content: z.string().min(1).max(4000),
  timestamp: z.string().datetime().optional(),
})

const csvImportSchema = z.object({
  // Hard cap: this endpoint bulk-inserts synchronously within the request
  // (no job queue), matching the CSV-only scope decision above — a real
  // Slack/Notion import at 10,000+ message scale would need the async
  // job pattern used elsewhere (e.g. meeting summary), but a first-pass
  // CSV onboarding import realistically fits well under this limit.
  rows: z.array(csvImportRowSchema).min(1).max(2000),
})

export const workspaceRoutes = async (app: FastifyInstance): Promise<void> => {
  const cache = new CacheService(app.redis)

  // All workspace routes require authentication
  app.addHook('preHandler', app.authenticate)

  // ─── GET /v1/workspaces ───────────────────────────────────────────
  app.get('/', {
    handler: async (req) => {
      const userId = req.user.sub

      return cache.getOrSet(
        cacheKeys.userWorkspaces(userId),
        CACHE_TTL.MEDIUM,
        async () => {
          return app.db.workspaceMember.findMany({
            where: { userId, status: 'active' },
            include: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                  plan: true,
                  _count: { select: { members: { where: { status: 'active' } } } },
                },
              },
            },
            orderBy: { lastAccessedAt: 'desc' },
          })
        },
      )
    },
  })

  // ─── POST /v1/workspaces ──────────────────────────────────────────
  app.post('/', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      return withIdempotency(req, reply, app.redis, async () => {
        const body = createWorkspaceSchema.parse(req.body)
        const userId = req.user.sub

        const existing = await app.db.workspace.findUnique({
          where: { slug: body.slug },
          select: { id: true },
        })

        if (existing) {
          throw new ConflictError(`Workspace slug '${body.slug}' is already taken`)
        }

        const workspace = await app.db.$transaction(async (tx) => {
          const ws = await tx.workspace.create({
            data: {
              id: nanoid(21),
              name: body.name,
              slug: body.slug,
              ...(body.description !== undefined ? { description: body.description } : {}),
              plan: 'free',
              ownerId: userId,
              dataResidency: body.dataResidency,
            },
          })

          // Add creator as owner
          await tx.workspaceMember.create({
            data: {
              id: nanoid(21),
              workspaceId: ws.id,
              userId,
              role: 'owner',
              status: 'active',
            },
          })

          // Create default #general channel
          const channel = await tx.channel.create({
            data: {
              id: nanoid(21),
              workspaceId: ws.id,
              name: 'general',
              description: 'Company-wide announcements and work-based matters',
              type: 'public',
              createdById: userId,
            },
          })

          // Add creator to channel
          await tx.channelMember.create({
            data: {
              id: nanoid(21),
              channelId: channel.id,
              userId,
              role: 'admin',
            },
          })

          // Audit log
          await tx.auditLog.create({
            data: {
              id: nanoid(21),
              userId,
              workspaceId: ws.id,
              action: 'workspace.created',
              ipAddress: '',
              userAgent: '',
              metadata: { name: ws.name, slug: ws.slug },
            },
          })

          return ws
        })

        await cache.invalidateUser(userId)

        reply.status(201)
        return workspace
      })
    },
  })

  // ─── GET /v1/workspaces/:workspaceId ──────────────────────────────
  app.get('/:workspaceId', {
    handler: async (req) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = req.user.sub

      return cache.getOrSet(
        cacheKeys.workspace(workspaceId),
        CACHE_TTL.MEDIUM,
        async () => {
          const member = await app.db.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId } },
            select: { role: true, status: true },
          })

          if (!member || member.status !== 'active') {
            throw new ForbiddenError('Not a member of this workspace')
          }

          const workspace = await app.db.workspace.findUnique({
            where: { id: workspaceId },
            include: {
              _count: {
                select: {
                  members: { where: { status: 'active' } },
                  channels: { where: { deletedAt: null } },
                },
              },
            },
          })

          if (!workspace) throw new NotFoundError('Workspace', workspaceId)
          return { ...workspace, memberRole: member.role }
        },
      )
    },
  })

  // ─── PATCH /v1/workspaces/:workspaceId ────────────────────────────
  app.patch('/:workspaceId', {
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = req.user.sub
      const body = updateWorkspaceSchema.parse(req.body)

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      })

      if (!member || !['admin', 'owner'].includes(member.role)) {
        throw new ForbiddenError('Admin or owner role required')
      }

      const workspace = await app.db.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
          ...(body.settings !== undefined ? { settings: body.settings as any } : {}), // eslint-disable-line @typescript-eslint/no-explicit-any
          updatedAt: new Date(),
        },
      })

      await cache.invalidateWorkspace(workspaceId)

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId,
          action: 'workspace.updated',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: body as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        },
      })

      reply.status(200)
      return workspace
    },
  })

  // ─── PUT /v1/workspaces/:workspaceId/llm-config ───────────────────
  // PRD_AUDIT.md Finding #6: PRD §19/§20 specify "Enterprise can bring
  // their own LLM endpoint (BYO LLM)." Stored in Workspace.settings.llm
  // (the existing generic settings JSON column) with the API key
  // encrypted at rest — never stored or returned in plaintext, same
  // discipline as SSO certificates and webhook secrets elsewhere in this
  // codebase.
  app.put('/:workspaceId/llm-config', {
    preHandler: [app.authenticate],
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = req.user.sub
      const body = z.object({
        endpoint: z.string().url(),
        apiKey: z.string().min(1),
        model: z.string().optional(),
        enabled: z.boolean().default(true),
      }).parse(req.body)

      const workspace = await app.db.workspace.findUnique({
        where: { id: workspaceId },
        select: { plan: true, settings: true },
      })
      if (!workspace) throw new NotFoundError('Workspace')

      if (workspace.plan !== 'enterprise') {
        throw new ForbiddenError('BYO LLM configuration requires the Enterprise plan')
      }

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      })
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw new ForbiddenError('Admin required to configure the LLM endpoint')
      }

      const existingSettings = (workspace.settings as Record<string, unknown>) ?? {}
      const updatedSettings = {
        ...existingSettings,
        llm: {
          endpoint: body.endpoint,
          encryptedApiKey: encrypt(body.apiKey),
          model: body.model,
          enabled: body.enabled,
        },
      }

      await app.db.workspace.update({
        where: { id: workspaceId },
        data: { settings: updatedSettings },
      })

      await cache.invalidateWorkspace(workspaceId)

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId,
          action: 'workspace.llm_config_updated',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          // Deliberately excludes the API key and endpoint from the audit
          // log metadata — an admin's BYO credential should not be
          // readable by every other admin browsing the audit trail, only
          // by whoever configured it (who already has it) and platform
          // super admins with direct database access if truly needed.
          metadata: { model: body.model, enabled: body.enabled },
        },
      })

      reply.status(200)
      return { message: 'LLM configuration updated', endpoint: body.endpoint, model: body.model, enabled: body.enabled }
    },
  })

  // ─── GET /v1/workspaces/:workspaceId/llm-config ───────────────────
  app.get('/:workspaceId/llm-config', {
    preHandler: [app.authenticate],
    handler: async (req) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = req.user.sub

      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      })
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw new ForbiddenError('Admin required')
      }

      const workspace = await app.db.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
      })
      if (!workspace) throw new NotFoundError('Workspace')

      const settings = workspace.settings as { llm?: { endpoint?: string; model?: string; enabled?: boolean } } | null
      const llm = settings?.llm

      if (!llm) return { configured: false }

      // Never returns the API key, even to an admin who set it — the
      // same one-shot-visibility discipline already used for API keys
      // and webhook secrets elsewhere in this codebase (shown once at
      // creation, never retrievable afterward).
      return {
        configured: true,
        endpoint: llm.endpoint,
        model: llm.model,
        enabled: llm.enabled ?? true,
      }
    },
  })

  // ─── POST /v1/workspaces/:workspaceId/invite ──────────────────────
  app.post('/:workspaceId/invite', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = req.user.sub
      const body = inviteMemberSchema.parse(req.body)

      const [inviter, workspace] = await Promise.all([
        app.db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId } },
          select: { role: true },
        }),
        app.db.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true, name: true, plan: true, _count: { select: { members: { where: { status: 'active' } } } } },
        }),
      ])

      if (!inviter || !['admin', 'owner'].includes(inviter.role)) {
        throw new ForbiddenError('Admin or owner role required to invite')
      }

      if (!workspace) throw new NotFoundError('Workspace', workspaceId)

      // Free plan seat limit
      if (workspace.plan === 'free' && workspace._count.members >= 3) {
        throw new ForbiddenError('Free plan is limited to 3 members. Upgrade to invite more.')
      }

      const token = nanoid(48)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const invite = await app.db.workspaceInvite.create({
        data: {
          id: nanoid(21),
          workspaceId,
          email: body.email,
          role: body.role,
          token,
          expiresAt,
          invitedById: userId,
        },
      })

      // Store invite token in Redis for fast lookup
      await app.redis.setex(`invite:${token}`, 7 * 24 * 60 * 60, JSON.stringify({
        workspaceId,
        email: body.email,
        role: body.role,
      }))

      // TODO: Queue email job
      // Bug fix (found via brace-balance sweep while building Finding #9):
      // this call had an extra closing paren — `}))` instead of `})` —
      // which is a hard TypeScript compile error, not a logic bug. Unrelated
      // to any of this session's onboarding work; found while adding the
      // CSV import route just below this handler.
      await enqueueEmail({
        type: 'workspace.invite',
        to: body.email,
        data: { workspaceName: workspace.name, token, inviteId: invite.id },
      })

      reply.status(201)
      return { message: 'Invitation sent', inviteId: invite.id, expiresAt }
    },
  })

  // ─── POST /v1/workspaces/:workspaceId/import/csv ──────────────────
  // PRD_AUDIT.md Finding #9: onboarding's Quick Import (CSV) step.
  app.post('/:workspaceId/import/csv', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    handler: async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = req.user.sub
      const { rows } = csvImportSchema.parse(req.body)

      const [importer, workspace] = await Promise.all([
        app.db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId } },
          select: { role: true },
        }),
        app.db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } }),
      ])

      if (!importer || !['admin', 'owner'].includes(importer.role)) {
        throw new ForbiddenError('Admin or owner role required to import')
      }
      if (!workspace) throw new NotFoundError('Workspace', workspaceId)

      // Resolve author emails to real Users where possible. Honest scope
      // limitation, documented rather than silently worked around: this
      // import can only attribute a message to a real CollabOS account.
      // A CSV exported from Slack/Notion will very often contain authors
      // who don't have one yet (pending invites haven't been accepted,
      // or never will be). Rather than fabricating placeholder User rows
      // (which would need passwordHash, would show up as "real" members
      // everywhere else in the app, and could collide with a real future
      // signup at that email), unmatched rows are imported under the
      // importing admin's account with the original author's email
      // preserved as a visible text prefix — content and history are
      // preserved losslessly, just not with a clickable author identity
      // for people who never had an account here.
      const distinctEmails = Array.from(new Set(rows.map((r) => r.authorEmail)))
      const knownUsers = await app.db.user.findMany({
        where: { email: { in: distinctEmails } },
        select: { id: true, email: true },
      })
      const emailToUserId = new Map(knownUsers.map((u) => [u.email, u.id]))

      const distinctChannelNames = Array.from(new Set(rows.map((r) => r.channelName)))
      const existingChannels = await app.db.channel.findMany({
        where: { workspaceId, name: { in: distinctChannelNames } },
        select: { id: true, name: true },
      })
      const channelNameToId = new Map(existingChannels.map((c) => [c.name, c.id]))

      let created = 0
      let attributedToOriginalAuthor = 0
      let attributedToImporter = 0

      await app.db.$transaction(async (tx) => {
        for (const name of distinctChannelNames) {
          if (channelNameToId.has(name)) continue
          const channel = await tx.channel.create({
            data: {
              id: nanoid(21),
              workspaceId,
              name,
              type: 'public',
              createdById: userId,
            },
          })
          channelNameToId.set(name, channel.id)
          await tx.channelMember.create({
            data: { id: nanoid(21), channelId: channel.id, userId, role: 'admin' },
          })
        }

        for (const row of rows) {
          const channelId = channelNameToId.get(row.channelName)
          if (!channelId) continue // unreachable given the loop above, but keeps this defensive

          const matchedUserId = emailToUserId.get(row.authorEmail)
          const authorId = matchedUserId ?? userId
          const content = matchedUserId ? row.content : `[Imported, originally by ${row.authorEmail}] ${row.content}`

          await tx.message.create({
            data: {
              id: nanoid(21),
              channelId,
              authorId,
              content,
              createdAt: row.timestamp ? new Date(row.timestamp) : new Date(),
            },
          })

          created += 1
          if (matchedUserId) attributedToOriginalAuthor += 1
          else attributedToImporter += 1
        }

        await tx.auditLog.create({
          data: {
            id: nanoid(21),
            userId,
            workspaceId,
            action: 'workspace.csv_import',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] ?? '',
            metadata: { rowCount: rows.length, created, attributedToOriginalAuthor, attributedToImporter },
          },
        })
      })

      await cache.invalidateUser(userId)

      reply.status(201)
      return {
        message: 'Import complete',
        channelsCreated: distinctChannelNames.filter((n) => !existingChannels.some((c) => c.name === n)).length,
        messagesCreated: created,
        attributedToOriginalAuthor,
        attributedToImporter,
      }
    },
  })

  // ─── GET /v1/workspaces/:workspaceId/members ──────────────────────
  app.get('/:workspaceId/members', {
    handler: async (req) => {
      const { workspaceId } = req.params as { workspaceId: string }
      const userId = req.user.sub

      // Verify membership
      const membership = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true, status: true },
      })

      if (!membership || membership.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      return cache.getOrSet(
        cacheKeys.workspaceMembers(workspaceId),
        CACHE_TTL.MEDIUM,
        () =>
          app.db.workspaceMember.findMany({
            where: { workspaceId, status: 'active' },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { joinedAt: 'asc' },
          }),
      )
    },
  })

  // ─── GET /v1/workspaces/invite/:token ─────────────────────────────
  // Bug fix (found via a real `tsc -p` build once the tsconfig `paths`
  // rootDir issue was cleared out of the way): a stray `}` used to sit
  // right before this route, prematurely closing the exported
  // `workspacesRoutes` function itself. Everything from here through
  // the end of the file — this route, invite-accept below it, and (until
  // this session's onboarding work) whatever routes came after — was
  // silently sitting at module top-level scope instead of inside that
  // function, referencing `app` as a free variable. This wasn't just a
  // build-time type error: at module-evaluation time (any runtime, tsx
  // dev mode included) these `app.get(...)` calls would have executed
  // immediately on import with no `app` in scope, throwing
  // `ReferenceError: app is not defined` and crashing the API on
  // startup — so either this file was never actually imported/exercised
  // end-to-end before, or something else in the surrounding module
  // graph masked it. `tsc -p` is just what finally surfaced it here.
  app.get('/invite/:token', {
    handler: async (req) => {
      const { token } = req.params as { token: string }

      const cachedRaw = await app.redis.get(`invite:${token}`)
      let workspaceId: string
      let email: string
      let role: string

      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { workspaceId: string; email: string; role: string }
        workspaceId = cached.workspaceId
        email = cached.email
        role = cached.role
      } else {
        const invite = await app.db.workspaceInvite.findUnique({
          where: { token },
          select: { workspaceId: true, email: true, role: true, expiresAt: true, acceptedAt: true },
        })
        if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
          throw new NotFoundError('Invitation')
        }
        workspaceId = invite.workspaceId
        email = invite.email
        role = invite.role
      }

      const [workspace, inviter] = await Promise.all([
        app.db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, slug: true } }),
        app.db.workspaceInvite.findUnique({
          where: { token },
          include: { invitedBy: { select: { name: true } } },
        }),
      ])

      if (!workspace) throw new NotFoundError('Workspace')

      return {
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        inviterName: inviter?.invitedBy?.name,
        role,
        email,
      }
    },
  })

  // ─── POST /v1/workspaces/invite/:token/accept ─────────────────────
  app.post('/invite/:token/accept', {
    preHandler: [app.authenticate],
    handler: async (req, reply) => {
      const { token } = req.params as { token: string }
      const userId = req.user.sub

      const invite = await app.db.workspaceInvite.findUnique({
        where: { token },
        select: { id: true, workspaceId: true, email: true, role: true, expiresAt: true, acceptedAt: true },
      })

      if (!invite || invite.expiresAt < new Date()) {
        throw new NotFoundError('Invitation')
      }
      if (invite.acceptedAt) {
        // Already accepted — just ensure membership exists
        const existing = await app.db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
          select: { id: true },
        })
        if (existing) {
          reply.status(200)
          return { message: 'Already a member', workspaceId: invite.workspaceId }
        }
      }

      await app.db.$transaction(async (tx) => {
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
          create: {
            id: nanoid(21),
            workspaceId: invite.workspaceId,
            userId,
            role: invite.role as 'member' | 'admin',
            status: 'active',
          },
          update: { status: 'active', role: invite.role as 'member' | 'admin' },
        })

        await tx.workspaceInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        })

        // Auto-join the #general channel
        const generalChannel = await tx.channel.findFirst({
          where: { workspaceId: invite.workspaceId, name: 'general', deletedAt: null },
          select: { id: true },
        })
        if (generalChannel) {
          await tx.channelMember.upsert({
            where: { channelId_userId: { channelId: generalChannel.id, userId } },
            create: { id: nanoid(21), channelId: generalChannel.id, userId, role: 'member' },
            update: {},
          })
        }
      })

      await app.redis.del(`invite:${token}`)
      await app.redis.del(`workspace:${invite.workspaceId}:members`)

      await app.db.auditLog.create({
        data: {
          id: nanoid(21),
          userId,
          workspaceId: invite.workspaceId,
          action: 'workspace.invite_accepted',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? '',
          metadata: { token: token.slice(0, 8) + '...' },
        },
      })

      reply.status(200)
      return { message: 'Invitation accepted', workspaceId: invite.workspaceId }
    },
  })
}
