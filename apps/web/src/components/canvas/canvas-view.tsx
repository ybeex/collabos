'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Plus, Square, StickyNote, Minus, Maximize2, MousePointer2, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toaster'
import { authedFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
// nanoid: intentionally unused (see canvas node creation below) — new
// nodes get their id from the server response, not generated client-side.
import { useWebSocket } from '@/hooks/use-websocket'
import { useWorkspaceStore } from '@/stores/workspace'
import type { WSEvent } from '@collabos/shared'

interface CanvasNode {
  id: string
  canvasId: string
  type: string
  content: Record<string, unknown>
  x: number
  y: number
  width: number
  height: number
}

interface CanvasData {
  id: string
  name: string
  nodes: CanvasNode[]
}

interface CanvasViewProps {
  workspaceSlug: string
  canvasId: string
}

type Tool = 'select' | 'sticky' | 'shape' | 'pan'

const STICKY_COLORS = ['#fde8e5', '#e3f4ec', '#e8eeff', '#fff3e0', '#f3e8ff'] as const

export const CanvasView = ({ canvasId }: CanvasViewProps) => {
  const queryClient = useQueryClient()
  const svgRef = useRef<SVGSVGElement>(null)
  const searchParams = useSearchParams()
  // PRD_AUDIT.md Finding #4: PRD §13 specifies
  // /:workspace/canvas/:canvas-id?node=:node-id as a deep-linkable URL.
  // Same reasoning as the doc block-level link: a query param on the
  // existing route, not a duplicate route, since the whole canvas has to
  // load regardless of which node is being deep-linked to.
  const targetNodeId = searchParams.get('node')
  const [tool, setTool] = useState<Tool>('select')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [panning, setPanning] = useState<{ startX: number; startY: number; origPan: { x: number; y: number } } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { currentWorkspace } = useWorkspaceStore()

  const { data: canvas, isLoading } = useQuery({
    queryKey: ['canvas', canvasId],
    queryFn: () => authedFetch<CanvasData>(`/v1/canvases/${canvasId}`),
  })

  const [localNodes, setLocalNodes] = useState<CanvasNode[]>([])

  useEffect(() => {
    if (canvas?.nodes) setLocalNodes(canvas.nodes)
  }, [canvas?.nodes])

  // PRD_AUDIT.md Finding #4: once the target node exists in localNodes
  // (may not be present on first render, since the initial query and
  // localNodes hydration are separate ticks), select it and pan the
  // viewport so it's centered — the actual "preserves selected node"
  // behavior, not just a URL that resolves to the right canvas with no
  // visible effect once there.
  useEffect(() => {
    if (!targetNodeId) return
    const node = localNodes.find((n) => n.id === targetNodeId)
    if (!node || !svgRef.current) return

    setSelectedId(targetNodeId)

    const rect = svgRef.current.getBoundingClientRect()
    const nodeCenterX = node.x + node.width / 2
    const nodeCenterY = node.y + node.height / 2
    setPan({
      x: rect.width / 2 - nodeCenterX * zoom,
      y: rect.height / 2 - nodeCenterY * zoom,
    })
    // zoom intentionally excluded from deps — panning should react to
    // the node becoming available, not re-run every time the user
    // manually zooms after the initial deep-link pan has already happened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetNodeId, localNodes])

  // BUG-3 fix: the backend has always broadcast canvas.node.created and
  // canvas.node.moved over Redis pub/sub (routes/canvas/index.ts), but
  // nothing on the frontend was ever subscribed to receive them — localNodes
  // was hydrated once from the initial query and only ever mutated by the
  // local user's own actions. Two people on the same canvas never saw each
  // other's moves without a manual refresh, despite the marketing page
  // promising "real-time collaboration — see cursors live."
  //
  // We track which node mutations originated locally (via a short-lived
  // "recently sent by me" set) so that when our own update echoes back
  // through the WS broadcast, we don't redundantly reapply it and cause a
  // visible jump if our local optimistic position has since moved further.
  const recentlyLocalRef = useRef<Set<string>>(new Set())

  const markLocal = useCallback((nodeId: string) => {
    recentlyLocalRef.current.add(nodeId)
    setTimeout(() => recentlyLocalRef.current.delete(nodeId), 2000)
  }, [])

  const handleWsEvent = useCallback((event: WSEvent) => {
    // Backend payload shapes (routes/canvas/index.ts), confirmed by reading
    // the actual publish() calls rather than assumed:
    //   canvas.node.created → { canvasId, node: CanvasNode, createdBy }
    //   canvas.node.moved    → { canvasId, nodeId, x?, y?, width?, height?, userId }
    if (event.event === 'canvas.node.created') {
      const data = event.data as { canvasId?: string; node?: CanvasNode }
      if (!data.canvasId || data.canvasId !== canvasId || !data.node) return
      setLocalNodes((prev) => {
        if (prev.some((n) => n.id === data.node!.id)) return prev // already have it (our own optimistic insert)
        return [...prev, data.node!]
      })
      return
    }

    if (event.event === 'canvas.node.moved') {
      const data = event.data as { canvasId?: string; nodeId?: string; x?: number; y?: number }
      if (!data.canvasId || data.canvasId !== canvasId || !data.nodeId) return
      // Skip if this exact node move was just initiated by us — our own
      // mouseup handler already applied the final position locally, so
      // reapplying the broadcast would be redundant at best and a visible
      // snap-back at worst if we've since moved it again.
      if (recentlyLocalRef.current.has(data.nodeId)) return
      setLocalNodes((prev) => prev.map((n) =>
        n.id === data.nodeId ? { ...n, x: data.x ?? n.x, y: data.y ?? n.y } : n,
      ))
    }
  }, [canvasId])

  useWebSocket({ workspaceId: currentWorkspace?.id ?? '', onEvent: handleWsEvent })

  const addNode = useMutation({
    mutationFn: (data: Omit<CanvasNode, 'id' | 'canvasId'>) =>
      authedFetch<CanvasNode>(`/v1/canvases/${canvasId}/nodes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (node) => {
      markLocal(node.id)
      setLocalNodes((prev) => [...prev, node])
      setSelectedId(node.id)
      queryClient.invalidateQueries({ queryKey: ['canvas', canvasId] })
    },
    onError: () => toast.error('Failed to add node'),
  })

  const updateNode = useMutation({
    mutationFn: ({ id, ...data }: Partial<CanvasNode> & { id: string }) =>
      authedFetch(`/v1/canvases/${canvasId}/nodes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  })

  const svgPoint = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    }
  }, [pan, zoom])

  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== svgRef.current && !(e.target as Element).classList.contains('canvas-bg')) return

    setSelectedId(null)

    if (tool === 'sticky') {
      const pt = svgPoint(e)
      addNode.mutate({
        type: 'sticky',
        content: { text: '', color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)] },
        x: pt.x - 100,
        y: pt.y - 60,
        width: 200,
        height: 120,
      })
      setTool('select')
    } else if (tool === 'shape') {
      const pt = svgPoint(e)
      addNode.mutate({
        type: 'shape',
        content: { shape: 'rectangle', label: '' },
        x: pt.x - 75,
        y: pt.y - 40,
        width: 150,
        height: 80,
      })
      setTool('select')
    }
  }, [tool, svgPoint, addNode])

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (tool !== 'select') return
    setSelectedId(nodeId)
    const pt = svgPoint(e)
    const node = localNodes.find((n) => n.id === nodeId)
    if (!node) return
    setDragging({ nodeId, startX: pt.x, startY: pt.y, origX: node.x, origY: node.y })
  }, [tool, svgPoint, localNodes])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const pt = svgPoint(e)
      const dx = pt.x - dragging.startX
      const dy = pt.y - dragging.startY
      setLocalNodes((prev) => prev.map((n) =>
        n.id === dragging.nodeId ? { ...n, x: dragging.origX + dx, y: dragging.origY + dy } : n,
      ))
    }
    if (panning) {
      const dx = e.clientX - panning.startX
      const dy = e.clientY - panning.startY
      setPan({ x: panning.origPan.x + dx, y: panning.origPan.y + dy })
    }
  }, [dragging, panning, svgPoint])

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      const node = localNodes.find((n) => n.id === dragging.nodeId)
      if (node) {
        markLocal(dragging.nodeId)
        updateNode.mutate({ id: dragging.nodeId, x: node.x, y: node.y })
      }
    }
    setDragging(null)
    setPanning(null)
  }, [dragging, localNodes, updateNode, markLocal])

  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'pan' || e.button === 1) {
      setPanning({ startX: e.clientX, startY: e.clientY, origPan: { ...pan } })
    }
  }, [tool, pan])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => Math.max(0.2, Math.min(3, z * delta)))
  }, [])

  const handleNodeTextChange = useCallback((nodeId: string, text: string) => {
    setLocalNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, content: { ...n.content, text } } : n))
  }, [])

  const handleNodeTextBlur = useCallback((nodeId: string) => {
    const node = localNodes.find((n) => n.id === nodeId)
    if (node) updateNode.mutate({ id: nodeId, content: node.content })
    setEditingId(null)
  }, [localNodes, updateNode])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 border-b border-border bg-card flex items-center px-4 gap-2">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex-1 flex items-center justify-center bg-muted/20">
          <Skeleton className="h-64 w-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Canvas toolbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 gap-3">
        <span className="font-mono text-sm font-semibold">{canvas?.name}</span>
        <div className="flex items-center gap-1">
          {([
            { id: 'select' as Tool, icon: MousePointer2, label: 'Select (V)' },
            { id: 'sticky' as Tool, icon: StickyNote, label: 'Sticky note (S)' },
            { id: 'shape' as Tool, icon: Square, label: 'Shape (R)' },
            { id: 'pan' as Tool, icon: Move, label: 'Pan (Space)' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <Button
              key={id}
              variant="ghost"
              size="icon-sm"
              onClick={() => setTool(id)}
              className={cn(tool === id && 'bg-accent/15 text-accent')}
              aria-label={label}
              aria-pressed={tool === id}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(3, z * 1.2))} aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <span className="font-mono text-[10px] text-muted-foreground w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))} aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} aria-label="Reset view">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Canvas SVG surface */}
      <svg
        ref={svgRef}
        className={cn(
          'flex-1 w-full h-full bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px]',
          tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : '',
          tool === 'sticky' || tool === 'shape' ? 'cursor-crosshair' : '',
          tool === 'select' ? 'cursor-default' : '',
        )}
        onClick={handleSvgClick}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ userSelect: 'none' }}
      >
        <rect width="100%" height="100%" fill="transparent" className="canvas-bg" />
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {localNodes.map((node) => (
            <CanvasNodeRenderer
              key={node.id}
              node={node}
              isSelected={selectedId === node.id}
              isEditing={editingId === node.id}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
              onDoubleClick={() => { setSelectedId(node.id); setEditingId(node.id) }}
              onTextChange={(text) => handleNodeTextChange(node.id, text)}
              onTextBlur={() => handleNodeTextBlur(node.id)}
            />
          ))}
        </g>
      </svg>

      {/* Zoom level indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] text-muted-foreground/40 pointer-events-none">
        {localNodes.length} nodes
      </div>
    </div>
  )
}

interface NodeRendererProps {
  node: CanvasNode
  isSelected: boolean
  isEditing: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onTextChange: (text: string) => void
  onTextBlur: () => void
}

const CanvasNodeRenderer = ({ node, isSelected, isEditing, onMouseDown, onDoubleClick, onTextChange, onTextBlur }: NodeRendererProps) => {
  const text = (node.content as { text?: string }).text ?? ''
  const color = (node.content as { color?: string }).color ?? '#ffffff'
  const label = (node.content as { label?: string }).label ?? ''

  if (node.type === 'sticky') {
    return (
      <g transform={`translate(${node.x},${node.y})`} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
        <rect
          width={node.width}
          height={node.height}
          fill={color}
          stroke={isSelected ? '#e8400a' : 'rgba(0,0,0,0.1)'}
          strokeWidth={isSelected ? 2 : 1}
          rx={3}
          className="drop-shadow-sm"
        />
        {isEditing ? (
          <foreignObject x={8} y={8} width={node.width - 16} height={node.height - 16}>
            <textarea
              autoFocus
              defaultValue={text}
              onChange={(e) => onTextChange(e.target.value)}
              onBlur={onTextBlur}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font-dm-mono)', fontSize: '12px', lineHeight: '1.5', color: '#0d0d0d' }}
            />
          </foreignObject>
        ) : (
          <text x={node.width / 2} y={node.height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontFamily="var(--font-dm-mono)" fill="#0d0d0d" style={{ pointerEvents: 'none' }}>
            {text.slice(0, 100)}
          </text>
        )}
        {isSelected && (
          <rect x={-2} y={-2} width={node.width + 4} height={node.height + 4} fill="none" stroke="#e8400a" strokeWidth={2} strokeDasharray="4,2" rx={4} style={{ pointerEvents: 'none' }} />
        )}
      </g>
    )
  }

  if (node.type === 'shape') {
    return (
      <g transform={`translate(${node.x},${node.y})`} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
        <rect width={node.width} height={node.height} fill="white" stroke={isSelected ? '#e8400a' : '#0d0d0d'} strokeWidth={isSelected ? 2 : 1.5} rx={2} />
        <text x={node.width / 2} y={node.height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontFamily="var(--font-dm-mono)" fill="#0d0d0d" style={{ pointerEvents: 'none' }}>
          {label || text}
        </text>
      </g>
    )
  }

  if (node.type === 'text') {
    return (
      <g transform={`translate(${node.x},${node.y})`} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer' }}>
        <text fontSize={14} fontFamily="var(--font-dm-mono)" fill="#0d0d0d">{text}</text>
      </g>
    )
  }

  return null
}
