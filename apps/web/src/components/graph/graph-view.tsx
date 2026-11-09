'use client'

/**
 * PRD_AUDIT.md Finding #3: the Work Graph is real on the backend
 * (GET /v1/graph/:entityType/:entityId/links) but had no frontend view
 * anywhere in the app before this component.
 *
 * Layout: real radial positioning computed from the actual number of
 * connected nodes returned by the API — not a fixed illustration.
 */
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authedFetch } from '@/lib/api-client'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, CheckSquare, FileText, Palette, HelpCircle } from 'lucide-react'

interface GraphNode {
  entityType: string
  entityId: string
  title: string
  excerpt: string
}

interface GraphEdge {
  id: string
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  edgeType: string
  createdAt: string
}

interface GraphLinksResponse {
  center: GraphNode | null
  nodes: GraphNode[]
  edges: GraphEdge[]
  total: number
}

interface GraphViewProps {
  workspaceSlug: string
  itemId: string
  entityType: string
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  message: MessageSquare,
  task: CheckSquare,
  document: FileText,
  canvas: Palette,
  canvas_node: Palette,
}

const EDGE_LABELS: Record<string, string> = {
  converted_from: 'converted from',
  referenced_in: 'referenced in',
  mentioned_in: 'mentioned in',
  related_to: 'related to',
  produced_by: 'produced by',
  decided_in: 'decided in',
}

const entityHref = (workspaceSlug: string, node: GraphNode): string => {
  switch (node.entityType) {
    case 'task': return `/${workspaceSlug}/tasks?open=${node.entityId}`
    case 'document': return `/${workspaceSlug}/docs/${node.entityId}`
    case 'canvas': return `/${workspaceSlug}/canvas/${node.entityId}`
    case 'canvas_node': return `/${workspaceSlug}/canvas`
    case 'message': return `/${workspaceSlug}/channels`
    default: return `/${workspaceSlug}`
  }
}

export const GraphView = ({ workspaceSlug, itemId, entityType }: GraphViewProps) => {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['graph-links', entityType, itemId],
    queryFn: () => authedFetch<GraphLinksResponse>(`/v1/graph/${entityType}/${itemId}/links`),
  })

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="flex items-center justify-center h-96">
          <Skeleton className="h-24 w-24 rounded-full" />
        </div>
      </div>
    )
  }

  if (!data || !data.center || data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
        <HelpCircle className="h-10 w-10 text-muted-foreground/20" aria-hidden="true" />
        <p className="font-mono text-sm text-muted-foreground">No Work Graph connections found for this item.</p>
        <p className="font-mono text-xs text-muted-foreground/60 max-w-sm text-center">
          Connections appear automatically when a message becomes a task, a canvas sticky produces a task, or a document references other content.
        </p>
      </div>
    )
  }

  const { center, nodes, edges } = data

  const radius = Math.min(280, 140 + nodes.length * 8)
  const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1)

  const nodePositions = nodes.map((node, i) => {
    const angle = i * angleStep - Math.PI / 2
    return {
      node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    }
  })

  const edgeForNode = (node: GraphNode): GraphEdge | undefined =>
    edges.find((e) =>
      (e.sourceType === node.entityType && e.sourceId === node.entityId) ||
      (e.targetType === node.entityType && e.targetId === node.entityId),
    )

  const CenterIcon = ENTITY_ICONS[center.entityType] ?? HelpCircle

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="font-mono text-xs text-accent uppercase tracking-widest mb-2">Work Graph</p>
        <h1 className="font-mono text-2xl font-bold">{center.title}</h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          {edges.length} connection{edges.length !== 1 ? 's' : ''} across your workspace
        </p>
      </div>

      <div
        className="relative mx-auto"
        style={{ width: radius * 2 + 200, height: radius * 2 + 200 }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width={radius * 2 + 200}
          height={radius * 2 + 200}
          aria-hidden="true"
        >
          <defs>
            <marker id="graph-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--color-accent)" opacity="0.4" />
            </marker>
          </defs>
          {nodePositions.map(({ node, x, y }) => (
            <line
              key={node.entityId}
              x1={radius + 100}
              y1={radius + 100}
              x2={radius + 100 + x}
              y2={radius + 100 + y}
              stroke="var(--color-accent)"
              strokeWidth="1"
              strokeDasharray="4,3"
              opacity="0.35"
              markerEnd="url(#graph-arrow)"
            />
          ))}
        </svg>

        <button
          type="button"
          title={center.title}
          onClick={() => router.push(entityHref(workspaceSlug, center))}
          className="absolute flex flex-col items-center justify-center gap-1 h-28 w-28 rounded-full border-2 border-accent bg-accent/10 hover:bg-accent/20 transition-colors"
          style={{ left: radius + 100 - 56, top: radius + 100 - 56 }}
        >
          <CenterIcon className="h-6 w-6 text-accent" aria-hidden="true" />
          <span className="font-mono text-[10px] text-accent text-center px-2 line-clamp-2">{center.title}</span>
        </button>

        {nodePositions.map(({ node, x, y }) => {
          const Icon = ENTITY_ICONS[node.entityType] ?? HelpCircle
          const edge = edgeForNode(node)
          return (
            <div
              key={node.entityId}
              className="absolute flex flex-col items-center gap-1.5"
              style={{ left: radius + 100 + x - 90, top: radius + 100 + y - 40, width: 180 }}
            >
              <button
                type="button"
                title={node.title}
                onClick={() => router.push(entityHref(workspaceSlug, node))}
                className="flex flex-col gap-1 w-full p-3 rounded-lg border border-border bg-card hover:border-accent/40 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="font-mono text-xs font-semibold truncate">{node.title}</span>
                </div>
                {node.excerpt && (
                  <p className="font-mono text-[10px] text-muted-foreground line-clamp-2">{node.excerpt}</p>
                )}
                {edge && (
                  <Badge variant="default" className="text-[9px] self-start mt-0.5">
                    {EDGE_LABELS[edge.edgeType] ?? edge.edgeType}
                  </Badge>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
