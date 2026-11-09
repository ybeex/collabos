import type { FastifyInstance } from 'fastify'
// Bug fix (found via tsc): `ws` was only ever a transitive dependency (via
// @fastify/websocket) despite being imported directly here for its
// WebSocket type — worked at runtime by accident (transitive deps are
// still on disk), but had no guaranteed version and no @types/ws
// declaration, so `tsc -p` (real build) couldn't resolve it. Both are now
// declared directly in package.json.
import type { WebSocket } from 'ws'
import { logger } from '../../utils/logger.js'
import { handleDocConnection } from '../../services/yjs-sync.js'

interface WSClient {
  userId: string
  workspaceId: string
  socket: WebSocket
}

const clients = new Map<string, Set<WSClient>>()

/**
 * Super admin dashboard feature: immediately disconnect every currently
 * connected client for a workspace. Called by routes/super-admin/index.ts
 * the moment a workspace is suspended — without this, a member already
 * connected before the suspension happened would stay connected until
 * their next reconnect attempt, since the connect-time check added above
 * only gates NEW connections.
 *
 * This only closes sockets held by THIS process. Production runs 2 API
 * replicas (docker-compose.prod.yml) behind a load balancer, so a
 * suspended workspace's members could be connected to either replica —
 * the super-admin route also publishes a Redis pub/sub event that every
 * replica subscribes to via subscribeToForceDisconnects() below, so the
 * suspension takes effect across the whole fleet, not just whichever
 * replica happened to handle the suspend request.
 */
export const forceDisconnectWorkspace = (workspaceId: string, reason: string): number => {
  const workspaceClients = clients.get(workspaceId)
  if (!workspaceClients) return 0
  let count = 0
  for (const client of workspaceClients) {
    client.socket.close(4003, reason)
    count++
  }
  workspaceClients.clear()
  return count
}

const FORCE_DISCONNECT_CHANNEL = 'ws:force-disconnect-workspace'

/** Subscribes this process to cross-replica force-disconnect events. Called once from app.ts after the Redis plugin is registered. */
export const subscribeToForceDisconnects = (app: FastifyInstance): void => {
  const subscriber = app.redis.duplicate()
  subscriber.subscribe(FORCE_DISCONNECT_CHANNEL).catch((err: Error) => {
    logger.error({ err }, 'Failed to subscribe to force-disconnect channel')
  })
  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const { workspaceId, reason } = JSON.parse(message) as { workspaceId: string; reason: string }
      const count = forceDisconnectWorkspace(workspaceId, reason)
      if (count > 0) logger.info({ workspaceId, count }, 'Force-disconnected clients on suspension (cross-replica event)')
    } catch (err) {
      logger.error({ err }, 'Failed to process force-disconnect event')
    }
  })
}

/** Publishes a force-disconnect event for every replica to act on, including this one. Called by routes/super-admin/index.ts on workspace suspension. */
export const publishForceDisconnect = async (app: FastifyInstance, workspaceId: string, reason: string): Promise<void> => {
  await app.redis.publish(FORCE_DISCONNECT_CHANNEL, JSON.stringify({ workspaceId, reason }))
}

export const websocketRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/workspace/:workspaceId', { websocket: true }, async (socket, req) => {
    let userId: string
    try {
      const token = req.headers['sec-websocket-protocol'] ?? ''
      const decoded = app.jwt.verify(token) as { sub: string }
      userId = decoded.sub
    } catch {
      socket.close(4001, 'Unauthorized')
      return
    }

    const { workspaceId } = req.params as { workspaceId: string }

    // Super admin dashboard feature: a suspended workspace's members
    // should be disconnected from real-time access immediately, not just
    // blocked from new HTTP calls. This is the highest-value enforcement
    // point for suspension since WS connections are long-lived — a member
    // already connected when suspension happens stays connected until
    // their next reconnect attempt without this check.
    const workspace = await app.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { suspendedAt: true },
    })
    if (workspace?.suspendedAt) {
      socket.close(4003, 'Workspace suspended')
      return
    }

    // Verify workspace membership
    const member = await app.db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { status: true },
    })

    if (!member || member.status !== 'active') {
      socket.close(4003, 'Forbidden')
      return
    }

    const client: WSClient = { userId, workspaceId, socket }

    if (!clients.has(workspaceId)) clients.set(workspaceId, new Set())
    clients.get(workspaceId)!.add(client)

    // Update presence
    await app.redis.hset(`presence:${userId}`, {
      status: 'online',
      workspaceId,
      lastSeen: new Date().toISOString(),
    })
    await app.redis.expire(`presence:${userId}`, 300)

    // Subscribe to Redis pub/sub for this workspace
    const subscriber = app.redis.duplicate()
    await subscriber.subscribe(
      `ws:workspace:${workspaceId}`,
      `ws:user:${userId}`,
    )

    subscriber.on('message', (_channel: string, message: string) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(message)
      }
    })

    socket.on('message', async (rawData: Buffer) => {
      try {
        const msg = JSON.parse(rawData.toString()) as { event: string; data: unknown }

        if (msg.event === 'ping') {
          socket.send(JSON.stringify({ event: 'pong', data: null }))
          return
        }

        // Presence update
        if (msg.event === 'presence.update') {
          await app.redis.hset(`presence:${userId}`, msg.data as Record<string, string>)
          await app.redis.expire(`presence:${userId}`, 300)

          // Broadcast presence to workspace
          await app.redis.publish(
            `ws:workspace:${workspaceId}`,
            JSON.stringify({ event: 'presence.updated', data: { userId, ...(msg.data as object) } }),
          )
        }
      } catch (err) {
        logger.warn({ err }, 'Invalid WS message')
      }
    })

    // Server-side heartbeat — detect dead connections not caught by onclose
    const heartbeatTimer = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.ping()
      }
    }, 30000)

    socket.on('close', () => {
      clearInterval(heartbeatTimer)
      clients.get(workspaceId)?.delete(client)

      // Fire-and-forget cleanup — errors here must not throw
      Promise.allSettled([
        subscriber.unsubscribe().then(() => subscriber.quit()),
        app.redis.hset(`presence:${userId}`, 'status', 'offline'),
        app.redis.publish(
          `ws:workspace:${workspaceId}`,
          JSON.stringify({ event: 'presence.updated', data: { userId, status: 'offline' } }),
        ),
      ]).catch(() => {})

      logger.debug({ userId, workspaceId }, 'WebSocket client disconnected')
    })

    socket.on('error', (err: Error) => {
      logger.warn({ err, userId, workspaceId }, 'WebSocket error')
    })

    socket.send(JSON.stringify({ event: 'connected', data: { userId, workspaceId } }))
    logger.debug({ userId, workspaceId }, 'WebSocket client connected')
  })

  // PRD_AUDIT.md Finding #1: real-time CRDT document sync, closing the
  // gap where document editing was last-write-wins HTTP block
  // replacement. Deliberately a SEPARATE route and protocol from
  // /workspace/:workspaceId above — that socket carries JSON application
  // events; this one carries the binary Yjs sync/awareness wire protocol.
  app.get('/doc/:docId', { websocket: true }, async (socket, req) => {
    let userId: string

    const protocolHeader = req.headers['sec-websocket-protocol']
    const token = Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader

    if (!token) {
      socket.close(4001, 'Unauthorized')
      return
    }

    try {
      const decoded = app.jwt.verify(token) as { sub: string }
      userId = decoded.sub
    } catch {
      socket.close(4001, 'Unauthorized')
      return
    }

    const { docId } = req.params as { docId: string }

    // Same access-control logic as GET /v1/docs/:docId: public docs are
    // open to any authenticated user, private docs require active
    // workspace membership.
    const doc = await app.db.document.findUnique({
      where: { id: docId, deletedAt: null },
      select: { workspaceId: true, isPublic: true },
    })

    if (!doc) {
      socket.close(4004, 'Document not found')
      return
    }

    if (!doc.isPublic) {
      const member = await app.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
        select: { status: true },
      })
      if (!member || member.status !== 'active') {
        socket.close(4003, 'Forbidden')
        return
      }
    }

    const workspace = await app.db.workspace.findUnique({
      where: { id: doc.workspaceId },
      select: { suspendedAt: true },
    })
    if (workspace?.suspendedAt) {
      socket.close(4003, 'Workspace suspended')
      return
    }

    await handleDocConnection(socket, docId, app.db)
    logger.debug({ userId, docId }, 'Yjs doc WebSocket client connected')
  })
}
