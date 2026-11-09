import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createHmac } from 'node:crypto'
import { nanoid } from 'nanoid'
import { ForbiddenError, NotFoundError } from '../../utils/errors.js'
import { env, getLivekitApiSecret } from '../../utils/env.js'

const base64url = (obj: unknown): string =>
  Buffer.from(JSON.stringify(obj)).toString('base64url')

const generateLiveKitToken = (
  apiKey: string,
  apiSecret: string,
  identity: string,
  roomName: string,
  metadata?: string,
): string => {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: apiKey,
    sub: identity,
    iat: now,
    exp: now + 21600,
    nbf: now - 10,
    jti: nanoid(16),
    metadata,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  }
  const header = base64url({ alg: 'HS256', typ: 'JWT' })
  const payload = base64url(claims)
  const sig = createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${sig}`
}

export const videoRoutes = async (app: FastifyInstance): Promise<void> => {
  if (!env.ENABLE_VIDEO) {
    app.get('/status', async () => ({
      enabled: false,
      message: 'Set ENABLE_VIDEO=true and configure LIVEKIT_* vars to enable video calling.',
    }))
    return
  }

  app.addHook('preHandler', app.authenticate)

  // POST /v1/video/token — get a LiveKit room access token
  app.post('/token', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { channelId } = z.object({ channelId: z.string().min(1) }).parse(req.body)
      const userId = req.user.sub

      const channel = await app.db.channel.findUnique({
        where: { id: channelId, deletedAt: null },
        include: {
          members: { where: { userId }, select: { id: true } },
          workspace: { select: { plan: true } },
        },
      })

      if (!channel) throw new NotFoundError('Channel', channelId)
      if (channel.type === 'private' && channel.members.length === 0) throw new ForbiddenError('Access denied')
      if (channel.workspace.plan === 'free') throw new ForbiddenError('Video calling requires Pro plan or above')

      const user = await app.db.user.findUnique({
        where: { id: userId },
        select: { name: true, avatarUrl: true },
      })
      if (!user) throw new NotFoundError('User')

      const roomName = `channel:${channelId}`
      const token = generateLiveKitToken(
        env.LIVEKIT_API_KEY,
        getLivekitApiSecret(),
        userId,
        roomName,
        JSON.stringify({ name: user.name, avatarUrl: user.avatarUrl }),
      )

      // Track active call participants in Redis
      await app.redis.hset(
        `call:${channelId}`,
        userId,
        JSON.stringify({ joinedAt: new Date().toISOString(), name: user.name }),
      )
      await app.redis.expire(`call:${channelId}`, 21600) // 6 hour TTL

      // PRD_AUDIT.md Finding #2: on the FIRST participant joining (no
      // existing active call), generate a callId and create the
      // CallTranscript row that segments will be appended to. Existing
      // participants joining an already-active call reuse the callId
      // already stored in Redis.
      let callId = await app.redis.get(`call:${channelId}:callId`)
      if (!callId) {
        callId = nanoid(21)
        await app.redis.setex(`call:${channelId}:callId`, 21600, callId)
        await app.db.callTranscript.create({
          data: { id: nanoid(21), channelId, callId },
        })
      }

      await app.redis.publish(
        `ws:channel:${channelId}`,
        JSON.stringify({
          event: 'call.participant_joined',
          data: { channelId, userId, userName: user.name },
        }),
      )

      reply.status(200)
      return { token, livekitUrl: env.LIVEKIT_URL, room: roomName, callId }
    },
  })

  // POST /v1/video/:channelId/transcript — ingest a transcript segment
  // PRD_AUDIT.md Finding #2: capture side of meeting transcription.
  // Clients using the browser's native Web Speech API POST each
  // recognized speech segment here as it's produced.
  app.post('/:channelId/transcript', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { channelId } = req.params as { channelId: string }
      const userId = req.user.sub
      const body = z.object({
        text: z.string().min(1).max(2000).trim(),
      }).parse(req.body)

      const callId = await app.redis.get(`call:${channelId}:callId`)
      if (!callId) {
        // No active call for this channel — legitimate if a segment
        // arrives just after the call ended.
        reply.status(204).send()
        return
      }

      const transcript = await app.db.callTranscript.findUnique({
        where: { callId },
        select: { id: true },
      })
      if (!transcript) {
        reply.status(204).send()
        return
      }

      const user = await app.db.user.findUnique({ where: { id: userId }, select: { name: true } })
      if (!user) throw new NotFoundError('User')

      await app.db.callTranscriptSegment.create({
        data: {
          id: nanoid(21),
          transcriptId: transcript.id,
          speakerId: userId,
          speakerName: user.name,
          text: body.text,
        },
      })

      reply.status(201).send()
    },
  })

  // GET /v1/video/:channelId/participants — active call members
  app.get('/:channelId/participants', {
    handler: async (req) => {
      const { channelId } = req.params as { channelId: string }
      const userId = req.user.sub

      const channel = await app.db.channel.findUnique({
        where: { id: channelId, deletedAt: null },
        include: { members: { where: { userId }, select: { id: true } } },
      })
      if (!channel) throw new NotFoundError('Channel')
      if (channel.type === 'private' && channel.members.length === 0) throw new ForbiddenError('Access denied')

      const raw = await app.redis.hgetall(`call:${channelId}`)
      if (!raw || Object.keys(raw).length === 0) return { participants: [], active: false }

      const participants = Object.entries(raw).map(([uid, data]) => ({
        userId: uid,
        ...(JSON.parse(data) as { joinedAt: string; name: string }),
      }))

      return { participants, active: true }
    },
  })

  // POST /v1/video/:channelId/leave — participant leaving the call
  app.post('/:channelId/leave', {
    handler: async (req, reply) => {
      const { channelId } = req.params as { channelId: string }
      const userId = req.user.sub

      await app.redis.hdel(`call:${channelId}`, userId)
      const remaining = await app.redis.hlen(`call:${channelId}`)

      if (remaining === 0) {
        // PRD_AUDIT.md Finding #2: last participant leaving ends the call
        // — finalize the transcript and kick off async summarization,
        // matching PRD §14 Flow 4's "within ~30 seconds" expectation.
        const callId = await app.redis.get(`call:${channelId}:callId`)
        if (callId) {
          const transcript = await app.db.callTranscript.findUnique({
            where: { callId },
            select: { id: true },
          })
          if (transcript) {
            await app.db.callTranscript.update({
              where: { id: transcript.id },
              data: { endedAt: new Date() },
            })

            const channel = await app.db.channel.findUnique({
              where: { id: channelId },
              select: { workspaceId: true },
            })
            if (channel) {
              const { enqueueMeetingSummary } = await import('../../jobs/queues/index.js')
              await enqueueMeetingSummary({
                transcriptId: transcript.id,
                channelId,
                workspaceId: channel.workspaceId,
              })
            }
          }
          await app.redis.del(`call:${channelId}:callId`)
        }
      }

      await app.redis.publish(
        `ws:channel:${channelId}`,
        JSON.stringify({
          event: remaining === 0 ? 'call.ended' : 'call.participant_left',
          data: { channelId, userId },
        }),
      )

      reply.status(204).send()
    },
  })
}
