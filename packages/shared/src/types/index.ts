// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserPlan = 'free' | 'pro' | 'business' | 'enterprise'
export type MemberRole = 'owner' | 'admin' | 'member' | 'guest'
export type MemberStatus = 'active' | 'invited' | 'suspended' | 'left'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  plan: UserPlan
  timezone: string
  createdAt: string
  // Super admin dashboard feature: platform-wide trust tier, independent
  // of any workspace role. See schema.prisma User.isSuperAdmin comment.
  isSuperAdmin: boolean
  // PRD_AUDIT.md Finding #9 (onboarding): PRD §14 Flow 1 Role Selection
  // step. Nullable — existing pre-onboarding accounts have none, and the
  // frontend redirect logic treats null the same as "no preference,
  // fall through to the pre-existing unconditional redirect."
  onboardingRole: 'pm' | 'dev' | 'designer' | null
}

export interface AuthTokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// ─── Workspace ────────────────────────────────────────────────────────────────

export type WorkspacePlan = 'free' | 'pro' | 'business' | 'enterprise'

export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  plan: WorkspacePlan
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: MemberRole
  status: MemberStatus
  joinedAt: string
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
}

// ─── Channel ──────────────────────────────────────────────────────────────────

export type ChannelType = 'public' | 'private' | 'direct'

export interface Channel {
  id: string
  workspaceId: string
  name: string
  description: string | null
  type: ChannelType
  createdAt: string
  updatedAt: string
  _count?: { members: number; messages: number }
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  channelId: string
  authorId: string
  content: string
  threadId: string | null
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  author: Pick<User, 'id' | 'name' | 'avatarUrl'>
  reactions: MessageReaction[]
  attachments: Attachment[]
}

export interface MessageReaction {
  emoji: string
  userId: string
}

export interface Attachment {
  id: string
  name: string
  url: string
  mimeType: string
  size: number
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'

export interface Task {
  id: string
  workspaceId: string
  projectId: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  createdById: string
  dueDate: string | null
  tags: string[]
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  assignee: Pick<User, 'id' | 'name' | 'avatarUrl'> | null
  createdBy: Pick<User, 'id' | 'name'>
}

// ─── Document ─────────────────────────────────────────────────────────────────

export type BlockType =
  | 'paragraph' | 'heading1' | 'heading2' | 'heading3'
  | 'code' | 'quote' | 'callout' | 'bulleted_list'
  | 'numbered_list' | 'todo' | 'divider' | 'image'
  | 'file' | 'embed' | 'task_embed' | 'table' | 'canvas_embed'

export interface DocumentBlock {
  id: string
  documentId: string
  type: BlockType
  content: Record<string, unknown>
  order: number
  parentBlockId: string | null
}

export interface Document {
  id: string
  workspaceId: string
  title: string
  icon: string | null
  parentId: string | null
  isPublic: boolean
  createdById: string
  lastEditedById: string
  createdAt: string
  updatedAt: string
}

// ─── Work Graph ───────────────────────────────────────────────────────────────

export type EdgeType =
  | 'converted_from' | 'referenced_in' | 'mentioned_in'
  | 'related_to' | 'produced_by' | 'decided_in'

export interface WorkGraphEdge {
  id: string
  workspaceId: string
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  edgeType: EdgeType
  createdById: string
  createdAt: string
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
  hasNextPage: boolean
  hasPrevPage: boolean
  nextCursor: string | null
  prevCursor: string | null
  total?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

export type WSEvent =
  | { event: 'message.created'; data: Message }
  | { event: 'message.updated'; data: Partial<Message> & { id: string } }
  | { event: 'message.deleted'; data: { id: string } }
  | { event: 'message.reaction'; data: { messageId: string; reactions: MessageReaction[] } }
  | { event: 'task.created'; data: Task }
  | { event: 'task.status_changed'; data: { taskId: string; from: TaskStatus; to: TaskStatus; updatedBy: string } }
  | { event: 'task.deleted'; data: { taskId: string } }
  | { event: 'channel.created'; data: Channel }
  | { event: 'doc.created'; data: Pick<Document, 'id' | 'title'> }
  | { event: 'doc.meta_updated'; data: Partial<Document> & { id: string } }
  | { event: 'presence.updated'; data: { userId: string; status: string; activeChannel?: string } }
  | { event: 'connected'; data: { userId: string; workspaceId: string } }
  | { event: 'ping'; data: null }
  | { event: 'pong'; data: null }
  // Bug fix (found via a real tsc pass on apps/web): the canvas route
  // (apps/api/src/routes/canvas/index.ts) has always published these two
  // events over the workspace WS channel, and canvas-view.tsx has always
  // handled them — this union just never listed them, so the handler
  // compiled only because the surrounding code was never actually
  // type-checked end-to-end before. Payload shapes match what the route
  // actually publishes.
  | { event: 'canvas.node.created'; data: { canvasId: string; node: unknown; createdBy: string } }
  | { event: 'canvas.node.moved'; data: { canvasId: string; nodeId: string; x?: number; y?: number; width?: number; height?: number; userId: string } }

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number
  error: string
  message: string
  code: string
  details?: unknown
  requestId: string
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface WorkspaceOverview {
  members: number
  channels: number
  tasks: number
  docs: number
  messagesLast30Days: number
  tasksByStatus: Array<{ status: TaskStatus; count: number }>
}

export interface AuditLogEntry {
  id: string
  action: string
  ipAddress: string
  metadata: Record<string, unknown>
  createdAt: string
  user?: Pick<User, 'id' | 'name' | 'email'>
}

// ─── Thread ───────────────────────────────────────────────────────────────────

export interface Thread {
  id: string
  messageId: string | null
  channelId: string
  lastReplyAt: string | null
  createdAt: string
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export interface CanvasNode {
  id: string
  canvasId: string
  type: 'sticky' | 'shape' | 'text' | 'image' | 'connector' | 'doc_embed' | 'task_embed' | 'frame'
  content: Record<string, unknown>
  x: number
  y: number
  width: number
  height: number
}

export interface Canvas {
  id: string
  workspaceId: string
  name: string
  thumbnail: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

// ─── Invite ───────────────────────────────────────────────────────────────────

export interface InviteData {
  workspaceName: string
  workspaceSlug: string
  inviterName?: string
  role: MemberRole
  email: string
}
