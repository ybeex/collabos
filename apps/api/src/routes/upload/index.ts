import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { ForbiddenError, ValidationError } from '../../utils/errors.js'
import { env } from '../../utils/env.js'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/webm',
])

const MAX_FILE_SIZE = env.MAX_FILE_SIZE_MB * 1024 * 1024

export const uploadRoutes = async (app: FastifyInstance): Promise<void> => {
  app.addHook('preHandler', app.authenticate)

  // ─── POST /v1/upload ──────────────────────────────────────────────
  app.post('/', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const userId = req.user.sub

      // Parse multipart
      const data = await req.file()
      if (!data) throw new ValidationError('No file provided')

      const { workspaceId } = z.object({ workspaceId: z.string() }).parse(
        Object.fromEntries(
          Object.entries(req.body as Record<string, { value: string }>).map(([k, v]) => [k, v.value]),
        ),
      )

      // Verify workspace membership
      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { status: true },
      })

      if (!member || member.status !== 'active') {
        throw new ForbiddenError('Not a member of this workspace')
      }

      // Validate mime type
      if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
        throw new ValidationError(`File type '${data.mimetype}' is not allowed`)
      }

      // Buffer and size check
      const chunks: Buffer[] = []
      let totalSize = 0

      for await (const chunk of data.file) {
        totalSize += chunk.length
        if (totalSize > MAX_FILE_SIZE) {
          throw new ValidationError(`File exceeds maximum size of ${env.MAX_FILE_SIZE_MB}MB`)
        }
        chunks.push(chunk)
      }

      const buffer = Buffer.concat(chunks)
      const fileId = nanoid(21)
      const ext = data.filename.split('.').pop() ?? ''
      const key = `uploads/${workspaceId}/${fileId}.${ext}`

      // Upload to S3-compatible storage
      const uploadRes = await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': data.mimetype,
          'Content-Length': String(totalSize),
          'x-amz-acl': 'private',
        },
        body: buffer,
      })

      if (!uploadRes.ok) {
        throw new ValidationError('File upload to storage failed')
      }

      const publicUrl = `${env.S3_PUBLIC_URL}/${key}`

      // Save attachment record
      const attachment = await app.db.attachment.create({
        data: {
          id: fileId,
          name: data.filename,
          url: publicUrl,
          mimeType: data.mimetype,
          size: totalSize,
          uploadedById: userId,
        },
      })

      reply.status(201)
      return attachment
    },
  })

  // ─── DELETE /v1/upload/:attachmentId ─────────────────────────────
  app.delete('/:attachmentId', {
    handler: async (req, reply) => {
      const { attachmentId } = req.params as { attachmentId: string }
      const userId = req.user.sub

      const attachment = await app.db.attachment.findUnique({
        where: { id: attachmentId },
        select: { id: true, url: true, uploadedById: true },
      })

      if (!attachment) {
        reply.status(404)
        return { error: 'Attachment not found' }
      }

      if (attachment.uploadedById !== userId) {
        throw new ForbiddenError('You can only delete your own uploads')
      }

      // Extract S3 key from URL for deletion
      const key = attachment.url.replace(`${env.S3_PUBLIC_URL}/`, '')

      await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`, {
        method: 'DELETE',
      })

      await app.db.attachment.delete({ where: { id: attachmentId } })

      // Bug fix (found via tsc): this used to call reply.status(204).send()
      // without a `return`, while the not-found branch above does
      // `return { error: ... }` — inconsistent return paths (one
      // explicit value, one implicit undefined) under noImplicitReturns.
      // Functionally harmless in Fastify (both patterns work), but the
      // explicit `return` makes every path in this handler consistent.
      return reply.status(204).send()
    },
  })
}
