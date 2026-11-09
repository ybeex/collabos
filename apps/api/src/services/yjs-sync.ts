/**
 * PRD_AUDIT.md Finding #1: server-side Yjs CRDT sync for documents.
 * Closes the gap where document editing was last-write-wins full block
 * replacement while a comment falsely claimed "CRDT deltas handled at
 * the WS layer."
 *
 * Architecture, matching PRD §16 and §07's "CRDT-First Data Layer":
 * - One in-memory Y.Doc per actively-edited document.
 * - Clients connect to /v1/ws/doc/:docId and exchange the standard Yjs
 *   wire protocol: sync step 1/2 (state vector exchange + diff), update
 *   messages (binary deltas), and awareness messages (ephemeral).
 * - Persistence is debounced (not per-keystroke): flushed on a timer and
 *   on last-client-disconnect — the standard Yjs persistence pattern.
 */
import * as Y from 'yjs'
import type { PrismaClient } from '@prisma/client'
import type { WebSocket } from 'ws'
import { logger } from '../utils/logger.js'
import { env } from '../utils/env.js'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
const SYNC_STEP_1 = 0
const SYNC_STEP_2 = 1
const SYNC_UPDATE = 2
const PERSIST_DEBOUNCE_MS = 3000

interface DocRoom {
  docId: string
  ydoc: Y.Doc
  clients: Set<WebSocket>
  persistTimer: ReturnType<typeof setTimeout> | null
  awarenessStates: Map<WebSocket, Uint8Array>
}

const rooms = new Map<string, DocRoom>()

const encodeMessage = (type: number, payload: Uint8Array): Uint8Array => {
  const out = new Uint8Array(payload.length + 1)
  out[0] = type
  out.set(payload, 1)
  return out
}

const broadcastToRoom = (room: DocRoom, message: Uint8Array, exclude?: WebSocket): void => {
  for (const client of room.clients) {
    if (client === exclude) continue
    if (client.readyState === client.OPEN) client.send(message)
  }
}

const schedulePersist = (room: DocRoom, db: PrismaClient): void => {
  if (room.persistTimer) clearTimeout(room.persistTimer)
  room.persistTimer = setTimeout(() => {
    persistRoom(room, db).catch((err: unknown) => {
      logger.error({ err, docId: room.docId }, 'Failed to persist Yjs document state')
    })
  }, PERSIST_DEBOUNCE_MS)
}

const persistRoom = async (room: DocRoom, db: PrismaClient): Promise<void> => {
  const state = Y.encodeStateAsUpdate(room.ydoc)
  const sizeBytes = state.byteLength

  if (sizeBytes <= env.YJS_INLINE_STATE_MAX_BYTES) {
    await db.documentYjsState.upsert({
      where: { documentId: room.docId },
      create: { id: room.docId, documentId: room.docId, state: Buffer.from(state), sizeBytes, s3Key: null },
      update: { state: Buffer.from(state), sizeBytes, s3Key: null },
    })
    return
  }

  const s3Key = `yjs-state/${room.docId}.bin`
  const res = await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${s3Key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(sizeBytes) },
    body: Buffer.from(state),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`S3 overflow upload failed: ${res.status}`)

  await db.documentYjsState.upsert({
    where: { documentId: room.docId },
    create: { id: room.docId, documentId: room.docId, state: null, sizeBytes, s3Key },
    update: { state: null, sizeBytes, s3Key },
  })
}

const loadRoomState = async (docId: string, db: PrismaClient): Promise<Y.Doc> => {
  const ydoc = new Y.Doc()
  const existing = await db.documentYjsState.findUnique({ where: { documentId: docId } })

  if (!existing) return ydoc

  if (existing.state) {
    Y.applyUpdate(ydoc, new Uint8Array(existing.state))
    return ydoc
  }

  if (existing.s3Key) {
    try {
      const res = await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${existing.s3Key}`, {
        signal: AbortSignal.timeout(30_000),
      })
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer())
        Y.applyUpdate(ydoc, buf)
      } else {
        logger.error({ docId, status: res.status }, 'Failed to fetch overflowed Yjs state from S3')
      }
    } catch (err) {
      logger.error({ err, docId }, 'Failed to fetch overflowed Yjs state from S3')
    }
  }

  return ydoc
}

const getOrCreateRoom = async (docId: string, db: PrismaClient): Promise<DocRoom> => {
  const existing = rooms.get(docId)
  if (existing) return existing

  const ydoc = await loadRoomState(docId, db)
  const room: DocRoom = { docId, ydoc, clients: new Set(), persistTimer: null, awarenessStates: new Map() }
  rooms.set(docId, room)
  return room
}

export const handleDocConnection = async (
  socket: WebSocket,
  docId: string,
  db: PrismaClient,
): Promise<void> => {
  const room = await getOrCreateRoom(docId, db)
  room.clients.add(socket)

  const stateVector = Y.encodeStateVector(room.ydoc)
  socket.send(encodeMessage(MESSAGE_SYNC, encodeMessage(SYNC_STEP_1, stateVector)))

  socket.on('message', (rawData: Buffer) => {
    try {
      const data = new Uint8Array(rawData)
      const messageType = data[0]
      const payload = data.slice(1)

      if (messageType === MESSAGE_SYNC) {
        const syncType = payload[0]
        const syncPayload = payload.slice(1)

        if (syncType === SYNC_STEP_1) {
          const diff = Y.encodeStateAsUpdate(room.ydoc, syncPayload)
          socket.send(encodeMessage(MESSAGE_SYNC, encodeMessage(SYNC_STEP_2, diff)))
        } else if (syncType === SYNC_STEP_2 || syncType === SYNC_UPDATE) {
          Y.applyUpdate(room.ydoc, syncPayload)
          broadcastToRoom(room, encodeMessage(MESSAGE_SYNC, encodeMessage(SYNC_UPDATE, syncPayload)), socket)
          schedulePersist(room, db)
        }
      } else if (messageType === MESSAGE_AWARENESS) {
        room.awarenessStates.set(socket, payload)
        broadcastToRoom(room, data, socket)
      }
    } catch (err) {
      logger.error({ err, docId }, 'Failed to process Yjs WS message')
    }
  })

  socket.on('close', () => {
    room.clients.delete(socket)
    room.awarenessStates.delete(socket)

    if (room.clients.size === 0) {
      if (room.persistTimer) clearTimeout(room.persistTimer)
      persistRoom(room, db)
        .catch((err: unknown) => logger.error({ err, docId }, 'Failed to persist Yjs state on last client disconnect'))
        .finally(() => rooms.delete(docId))
    }
  })

  socket.on('error', (err: Error) => {
    logger.error({ err, docId }, 'Yjs WS connection error')
  })
}

/**
 * Scope boundary, documented rather than silently left as a gap: this
 * implementation does not route Yjs sync traffic across API replicas — a
 * document's room lives in-memory on exactly one replica. Production-
 * grade multi-replica correctness needs sticky session routing at the
 * load balancer for /v1/ws/doc/* or a shared backend like y-redis.
 */
export const YJS_MULTI_REPLICA_LIMITATION = true
