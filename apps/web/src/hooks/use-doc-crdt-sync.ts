'use client'

/**
 * PRD_AUDIT.md Finding #1: client-side half of real-time CRDT document
 * sync. Connects to /v1/ws/doc/:docId (services/yjs-sync.ts +
 * routes/ws/index.ts), speaking the standard Yjs wire protocol.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { getAccessToken } from '@/lib/api-client'
import type { DocumentBlock } from '@collabos/shared'

const WS_BASE = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3001'

const MESSAGE_SYNC = 0
const SYNC_STEP_1 = 0
const SYNC_STEP_2 = 1
const SYNC_UPDATE = 2

const encodeMessage = (type: number, payload: Uint8Array): Uint8Array => {
  const out = new Uint8Array(payload.length + 1)
  out[0] = type
  out.set(payload, 1)
  return out
}

interface UseDocCrdtSyncResult {
  synced: boolean
  blocks: DocumentBlock[]
  updateBlockContent: (blockId: string, content: Record<string, unknown>) => void
  insertBlock: (block: DocumentBlock) => void
  removeBlock: (blockId: string) => void
}

export const useDocCrdtSync = (docId: string, initialBlocks: DocumentBlock[]): UseDocCrdtSyncResult => {
  const ydocRef = useRef<Y.Doc | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const yblocksRef = useRef<Y.Map<DocumentBlock> | null>(null)
  const [synced, setSynced] = useState<boolean>(false)
  const [blocks, setBlocks] = useState<DocumentBlock[]>(initialBlocks)
  const mountedRef = useRef<boolean>(true)

  useEffect(() => {
    mountedRef.current = true
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const yblocks = ydoc.getMap<DocumentBlock>('blocks')
    yblocksRef.current = yblocks

    ydoc.transact(() => {
      for (const block of initialBlocks) {
        yblocks.set(block.id, block)
      }
    })

    const syncBlocksToState = (): void => {
      if (!mountedRef.current) return
      const next = Array.from(yblocks.values()).sort((a, b) => a.order - b.order)
      setBlocks(next)
    }

    yblocks.observe(syncBlocksToState)
    syncBlocksToState()

    let cancelled = false

    const connect = async (): Promise<void> => {
      const token = getAccessToken()
      if (!token || cancelled) return

      const ws = new WebSocket(`${WS_BASE}/v1/ws/doc/${docId}`, token)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onmessage = (event: MessageEvent<ArrayBuffer>): void => {
        const data = new Uint8Array(event.data)
        const messageType = data[0]
        const payload = data.slice(1)

        if (messageType === MESSAGE_SYNC) {
          const syncType = payload[0]
          const syncPayload = payload.slice(1)

          if (syncType === SYNC_STEP_1) {
            const diff = Y.encodeStateAsUpdate(ydoc, syncPayload)
            ws.send(encodeMessage(MESSAGE_SYNC, encodeMessage(SYNC_STEP_2, diff)))
          } else if (syncType === SYNC_STEP_2) {
            Y.applyUpdate(ydoc, syncPayload)
            if (mountedRef.current) setSynced(true)
          } else if (syncType === SYNC_UPDATE) {
            Y.applyUpdate(ydoc, syncPayload)
          }
        }
      }

      ws.onerror = (): void => {
        // Degrades to local-only editing until reconnect — the Y.Doc
        // still works fully offline, per the PRD's "true offline-first"
        // CRDT requirement.
      }
    }

    void connect()

    const updateHandler = (update: Uint8Array, origin: unknown): void => {
      if (origin === 'remote') return
      const ws = wsRef.current
      // Bug fix (found via tsc): compared against the instance property
      // `ws.OPEN` after already null-guarding `ws` with `?.` — if `ws`
      // were null, `ws.OPEN` still dereferences it unguarded. `OPEN` is a
      // static constant (same value on every WebSocket instance), so
      // comparing against the constant on the class itself sidesteps the
      // null case entirely instead of needing a second guard.
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encodeMessage(MESSAGE_SYNC, encodeMessage(SYNC_UPDATE, update)))
      }
    }
    ydoc.on('update', updateHandler)

    return (): void => {
      mountedRef.current = false
      cancelled = true
      yblocks.unobserve(syncBlocksToState)
      ydoc.off('update', updateHandler)
      wsRef.current?.close()
      ydoc.destroy()
    }
    // initialBlocks intentionally excluded — it's a mount-time seed only;
    // a parent refetch should not tear down and recreate the CRDT session.
    // Bug fix (found via eslint): this suppression comment used to sit
    // AFTER this closing `}, [docId])` line, which meant it suppressed
    // nothing (eslint-disable-next-line applies to the line right below
    // it, not lines above) — the real missing-dependency warning fired
    // regardless, and ESLint separately flagged the misplaced comment
    // itself as an unused directive. Moved to actually attach to the
    // dependency array it's explaining.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  const updateBlockContent = useCallback((blockId: string, content: Record<string, unknown>): void => {
    const yblocks = yblocksRef.current
    const ydoc = ydocRef.current
    if (!yblocks || !ydoc) return
    const existing = yblocks.get(blockId)
    if (!existing) return
    ydoc.transact(() => {
      yblocks.set(blockId, { ...existing, content })
    })
  }, [])

  const insertBlock = useCallback((block: DocumentBlock): void => {
    const yblocks = yblocksRef.current
    const ydoc = ydocRef.current
    if (!yblocks || !ydoc) return
    ydoc.transact(() => {
      yblocks.set(block.id, block)
    })
  }, [])

  const removeBlock = useCallback((blockId: string): void => {
    const yblocks = yblocksRef.current
    const ydoc = ydocRef.current
    if (!yblocks || !ydoc) return
    ydoc.transact(() => {
      yblocks.delete(blockId)
    })
  }, [])

  return { synced, blocks, updateBlockContent, insertBlock, removeBlock }
}
