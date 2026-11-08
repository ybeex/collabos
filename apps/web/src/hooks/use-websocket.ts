'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { WSEvent } from '@collabos/shared'
import { useAuthStore } from '@/stores/auth'
import { usePresenceStore } from '@/stores/presence'

const WS_BASE = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3001'
const RECONNECT_DELAY_BASE = 1000
const MAX_RECONNECT_DELAY = 30000
const PING_INTERVAL = 30000

interface UseWebSocketOptions {
  workspaceId: string
  onEvent?: (event: WSEvent) => void
}

export const useWebSocket = ({ workspaceId, onEvent }: UseWebSocketOptions): {
  isConnected: boolean
  sendEvent: (event: { event: string; data: unknown }) => void
} => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isConnectedRef = useRef(false)
  const mountedRef = useRef(true)
  // Keep onEvent in a ref so changing the callback never triggers a reconnect
  const onEventRef = useRef(onEvent)
  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  const { refresh } = useAuthStore()
  const { updatePresence } = usePresenceStore()

  const connect = useCallback(async () => {
    if (!mountedRef.current) return

    // Ensure we have a valid access token
    const tokenValid = await refresh()
    if (!tokenValid || !mountedRef.current) return

    // Get current access token from store state — it was set by refresh()
    const { user } = useAuthStore.getState()
    if (!user) return

    // Access token is held in memory by the api-client module
    // We need to retrieve it to pass as the WebSocket protocol header
    // (Browsers don't support custom headers on WebSocket, so we use sec-websocket-protocol)
    const { getAccessToken } = await import('@/lib/api-client')
    const token = getAccessToken()
    if (!token || !mountedRef.current) return

    const ws = new WebSocket(
      `${WS_BASE}/v1/ws/workspace/${workspaceId}`,
      token, // sec-websocket-protocol carries the JWT
    )

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      isConnectedRef.current = true
      reconnectAttemptRef.current = 0

      // Heartbeat
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'ping', data: null }))
        }
      }, PING_INTERVAL)
    }

    ws.onmessage = (e: MessageEvent<string>) => {
      if (!mountedRef.current) return

      let parsed: WSEvent
      try {
        parsed = JSON.parse(e.data) as WSEvent
      } catch {
        return
      }

      if (parsed.event === 'pong') return

      if (parsed.event === 'presence.updated') {
        const d = parsed.data as { userId: string; status: string }
        updatePresence(d.userId, { status: d.status as 'online' | 'away' | 'offline' })
        return
      }

      onEventRef.current?.(parsed)
    }

    ws.onerror = () => {
      isConnectedRef.current = false
    }

    ws.onclose = () => {
      isConnectedRef.current = false
      if (pingTimerRef.current) clearInterval(pingTimerRef.current)

      if (!mountedRef.current) return

      // Exponential backoff reconnect
      const delay = Math.min(
        RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY,
      )
      reconnectAttemptRef.current++

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, delay)
    }

    wsRef.current = ws
  }, [workspaceId, refresh, updatePresence])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (pingTimerRef.current) clearInterval(pingTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendEvent = useCallback((event: { event: string; data: unknown }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event))
    }
  }, [])

  return { isConnected: isConnectedRef.current, sendEvent }
}
