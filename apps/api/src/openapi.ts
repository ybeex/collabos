type JsonSchema = Record<string, unknown>

const string = (format?: string): JsonSchema => ({ type: 'string', ...(format ? { format } : {}) })
const nullable = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: 'null' }] })
const array = (items: JsonSchema): JsonSchema => ({ type: 'array', items })
const object = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false,
})
const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` })
const list = (name: string): JsonSchema => array(ref(name))
const paginated = (name: string): JsonSchema => object({ data: list(name), meta: ref('PaginationMeta') }, ['data', 'meta'])
const jsonObject: JsonSchema = { type: 'object', additionalProperties: true }

const id = string()
const dateTime = string('date-time')

export const openApiSchemas: Record<string, JsonSchema> = {
  ApiError: object({
    statusCode: { type: 'integer' }, error: string(), message: string(), code: string(),
    details: {}, requestId: string(),
  }, ['statusCode', 'error', 'message', 'code', 'requestId']),
  User: object({
    id, email: string('email'), name: string(), avatarUrl: nullable(string('uri')),
    plan: { type: 'string', enum: ['free', 'pro', 'business', 'enterprise'] },
    timezone: string(), createdAt: dateTime, isSuperAdmin: { type: 'boolean' },
    onboardingRole: nullable({ type: 'string', enum: ['pm', 'dev', 'designer'] }),
  }, ['id', 'email', 'name', 'plan', 'createdAt']),
  AuthSession: object({ user: ref('User'), accessToken: string(), refreshToken: string(), expiresIn: { type: 'integer' } }, ['user', 'accessToken', 'refreshToken', 'expiresIn']),
  TokenPair: object({ accessToken: string(), refreshToken: string(), expiresIn: { type: 'integer' } }, ['accessToken', 'refreshToken', 'expiresIn']),
  Workspace: object({
    id, name: string(), slug: string(), description: nullable(string()), logoUrl: nullable(string('uri')),
    plan: { type: 'string', enum: ['free', 'pro', 'business', 'enterprise'] }, ownerId: id,
    createdAt: dateTime, updatedAt: dateTime,
  }, ['id', 'name', 'slug', 'plan', 'ownerId', 'createdAt', 'updatedAt']),
  WorkspaceMembership: object({
    id, workspaceId: id, userId: id,
    role: { type: 'string', enum: ['owner', 'admin', 'member', 'guest'] },
    status: { type: 'string', enum: ['active', 'invited', 'suspended', 'left'] },
    joinedAt: dateTime, workspace: ref('Workspace'),
  }, ['id', 'workspaceId', 'userId', 'role', 'status', 'workspace']),
  PaginationMeta: object({ hasNextPage: { type: 'boolean' }, hasPrevPage: { type: 'boolean' }, nextCursor: nullable(string()), prevCursor: nullable(string()), total: { type: 'integer' } }, ['hasNextPage', 'hasPrevPage', 'nextCursor', 'prevCursor']),
  Channel: object({
    id, workspaceId: id, name: string(), description: nullable(string()),
    type: { type: 'string', enum: ['public', 'private', 'direct'] }, createdAt: dateTime, updatedAt: dateTime,
    _count: object({ members: { type: 'integer' }, messages: { type: 'integer' } }),
  }, ['id', 'workspaceId', 'name', 'type', 'createdAt', 'updatedAt']),
  Attachment: object({ id, name: string(), url: string('uri'), mimeType: string(), size: { type: 'integer' } }, ['id', 'name', 'url', 'mimeType', 'size']),
  MessageReaction: object({ emoji: string(), userId: id }, ['emoji', 'userId']),
  Message: object({
    id, channelId: id, authorId: id, content: string(), threadId: nullable(id),
    editedAt: nullable(dateTime), deletedAt: nullable(dateTime), createdAt: dateTime,
    author: object({ id, name: string(), avatarUrl: nullable(string('uri')) }, ['id', 'name']),
    reactions: list('MessageReaction'), attachments: list('Attachment'),
  }, ['id', 'channelId', 'authorId', 'content', 'createdAt']),
  Task: object({
    id, workspaceId: id, projectId: nullable(id), title: string(), description: nullable(string()),
    status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] },
    priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] }, assigneeId: nullable(id),
    createdById: id, dueDate: nullable(dateTime), tags: array(string()), deletedAt: nullable(dateTime),
    createdAt: dateTime, updatedAt: dateTime,
  }, ['id', 'workspaceId', 'title', 'status', 'priority', 'createdById', 'createdAt', 'updatedAt']),
  Document: object({ id, workspaceId: id, title: string(), icon: nullable(string()), parentId: nullable(id), isPublic: { type: 'boolean' }, createdById: id, lastEditedById: id, createdAt: dateTime, updatedAt: dateTime }, ['id', 'workspaceId', 'title', 'isPublic', 'createdById', 'lastEditedById', 'createdAt', 'updatedAt']),
  DocumentBlock: object({ id, documentId: id, type: string(), content: jsonObject, order: { type: 'number' }, parentBlockId: nullable(id) }, ['id', 'documentId', 'type', 'content', 'order']),
  Canvas: object({ id, workspaceId: id, name: string(), thumbnail: nullable(string('uri')), deletedAt: nullable(dateTime), createdAt: dateTime, updatedAt: dateTime }, ['id', 'workspaceId', 'name', 'createdAt', 'updatedAt']),
  CanvasWithNodes: object({ id, workspaceId: id, name: string(), thumbnail: nullable(string('uri')), nodes: list('CanvasNode'), createdAt: dateTime, updatedAt: dateTime }, ['id', 'workspaceId', 'name', 'nodes', 'createdAt', 'updatedAt']),
  CanvasNode: object({ id, canvasId: id, type: string(), content: jsonObject, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } }, ['id', 'canvasId', 'type', 'content', 'x', 'y', 'width', 'height']),
  Thread: object({ id, messageId: nullable(id), channelId: id, lastReplyAt: nullable(dateTime), createdAt: dateTime }, ['id', 'channelId', 'createdAt']),
  TaskComment: object({ id, taskId: id, authorId: id, content: string(), createdAt: dateTime, author: object({ id, name: string(), avatarUrl: nullable(string('uri')) }, ['id', 'name']) }, ['id', 'taskId', 'authorId', 'content', 'createdAt']),
  WorkspaceMember: object({ id, workspaceId: id, userId: id, role: string(), status: string(), joinedAt: dateTime, user: object({ id, name: string(), email: string('email'), avatarUrl: nullable(string('uri')) }, ['id', 'name', 'email']) }, ['id', 'workspaceId', 'userId', 'role', 'status', 'user']),
  Bookmark: object({ id, userId: id, entityType: string(), entityId: id, note: nullable(string()), createdAt: dateTime }, ['id', 'userId', 'entityType', 'entityId', 'createdAt']),
  ApiKey: object({ id, workspaceId: id, name: string(), keyPrefix: string(), scopes: array(string()), expiresAt: nullable(dateTime), createdAt: dateTime }, ['id', 'workspaceId', 'name', 'keyPrefix', 'scopes', 'createdAt']),
  Notification: object({ id, userId: id, type: string(), title: string(), body: string(), readAt: nullable(dateTime), createdAt: dateTime }, ['id', 'userId', 'type', 'title', 'createdAt']),
  AuditLogEntry: object({ id, action: string(), ipAddress: string(), metadata: jsonObject, createdAt: dateTime, user: ref('User') }, ['id', 'action', 'createdAt']),
  SearchResult: object({ type: string(), id, title: string(), content: string(), url: string(), score: { type: 'number' } }, ['type', 'id', 'title']),
  WebhookEndpoint: object({ id, workspaceId: id, url: string('uri'), events: array(string()), isActive: { type: 'boolean' }, createdAt: dateTime }, ['id', 'workspaceId', 'url', 'events', 'isActive', 'createdAt']),
  ScimUser: jsonObject,
  SsoConfig: object({ enabled: { type: 'boolean' }, entityId: string(), ssoUrl: string('uri'), certificate: string(), attributeMapping: jsonObject }, ['enabled']),
  MessageEnvelope: object({ message: ref('Message') }, ['message']),
  WorkspaceConfig: object({ endpoint: string('uri'), model: string(), enabled: { type: 'boolean' } }, ['endpoint', 'model', 'enabled']),
  ScimToken: object({ token: string(), warning: string(), scimBaseUrl: string('uri') }, ['token', 'warning', 'scimBaseUrl']),
  ScimList: object({ schemas: array(string()), totalResults: { type: 'integer' }, Resources: list('ScimUser'), startIndex: { type: 'integer' }, itemsPerPage: { type: 'integer' } }, ['schemas', 'totalResults', 'Resources']),
  VideoToken: object({ token: string(), livekitUrl: string('uri'), room: string(), callId: id }, ['token', 'livekitUrl', 'room', 'callId']),
  VideoParticipants: object({ active: { type: 'boolean' }, participants: array(object({ userId: id, joinedAt: dateTime, name: string() }, ['userId', 'joinedAt', 'name'])) }, ['active', 'participants']),
  NotificationPreferences: object({ mentions: { type: 'boolean' }, threadReplies: { type: 'boolean' }, taskAssigned: { type: 'boolean' }, taskUpdates: { type: 'boolean' }, weeklyDigest: { type: 'boolean' }, emailNotifications: { type: 'boolean' }, pushEnabled: { type: 'boolean' } }),
  StatusMessage: object({ message: string() }, ['message']),
  EmptyObject: object({}),
  NoContent: { type: 'null' },
  JsonObject: jsonObject,
}

const bodySchemas: Record<string, JsonSchema> = {
  'POST /v1/auth/register': object({ email: string('email'), password: { type: 'string', minLength: 8, maxLength: 128, format: 'password' }, name: { type: 'string', minLength: 1, maxLength: 100 } }, ['email', 'password', 'name']),
  'POST /v1/auth/login': object({ email: string('email'), password: { type: 'string', minLength: 1, format: 'password' } }, ['email', 'password']),
  'POST /v1/auth/refresh': object({ refreshToken: string() }, ['refreshToken']),
  'POST /v1/auth/logout': object({ refreshToken: string() }),
  'POST /v1/auth/forgot-password': object({ email: string('email') }, ['email']),
  'POST /v1/auth/reset-password': object({ token: string(), password: { type: 'string', minLength: 8, maxLength: 128, format: 'password' } }, ['token', 'password']),
  'PATCH /v1/auth/me': object({ name: { type: 'string', minLength: 1, maxLength: 100 }, timezone: { type: 'string', maxLength: 50 }, avatarUrl: nullable(string('uri')), onboardingRole: { type: 'string', enum: ['pm', 'dev', 'designer'] } }),
  'POST /v1/auth/sso/exchange': object({ exchangeToken: string() }, ['exchangeToken']),
  'POST /v1/auth/me/erasure-request': object({ password: string() }, ['password']),
  'POST /v1/workspaces': object({ name: { type: 'string', minLength: 1, maxLength: 100 }, slug: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[a-z0-9-]+$' }, description: { type: 'string', maxLength: 500 }, dataResidency: { type: 'string', enum: ['us', 'eu', 'apac'], default: 'us' } }, ['name', 'slug']),
  'PATCH /v1/workspaces/:workspaceId': object({ name: { type: 'string', minLength: 1, maxLength: 100 }, description: { type: 'string', maxLength: 500 }, logoUrl: string('uri'), settings: jsonObject }),
  'POST /v1/workspaces/:workspaceId/invite': object({ email: string('email'), role: { type: 'string', enum: ['member', 'admin'], default: 'member' } }, ['email']),
  'POST /v1/workspaces/:workspaceId/import/csv': object({ rows: { type: 'array', minItems: 1, maxItems: 2000, items: object({ channelName: { type: 'string', minLength: 1, maxLength: 80 }, authorEmail: string('email'), content: { type: 'string', minLength: 1, maxLength: 4000 }, timestamp: dateTime }, ['channelName', 'authorEmail', 'content']) } }, ['rows']),
  'POST /v1/channels': object({ workspaceId: id, name: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[a-z0-9-_]+$' }, description: { type: 'string', maxLength: 250 }, type: { type: 'string', enum: ['public', 'private'], default: 'public' } }, ['workspaceId', 'name']),
  'POST /v1/messages': object({ channelId: id, content: { type: 'string', minLength: 1, maxLength: 10000 }, threadId: id, attachmentIds: { type: 'array', maxItems: 10, items: id } }, ['channelId', 'content']),
  'PATCH /v1/messages/:messageId': object({ content: { type: 'string', minLength: 1, maxLength: 10000 } }, ['content']),
  'POST /v1/messages/:messageId/reactions': object({ emoji: { type: 'string', minLength: 1, maxLength: 12 } }, ['emoji']),
  'POST /v1/messages/:messageId/tasks': object({ title: { type: 'string', minLength: 1, maxLength: 500 }, projectId: id, assigneeId: id, dueDate: dateTime }, ['title']),
  'POST /v1/tasks': object({ title: { type: 'string', minLength: 1, maxLength: 500 }, description: { type: 'string', maxLength: 10000 }, workspaceId: id, projectId: id, assigneeId: id, dueDate: dateTime, priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], default: 'medium' }, status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'], default: 'todo' }, tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 50 } } }, ['title', 'workspaceId']),
  'PATCH /v1/tasks/:taskId': object({ title: { type: 'string', minLength: 1, maxLength: 500 }, description: { type: 'string', maxLength: 10000 }, projectId: id, assigneeId: id, dueDate: dateTime, priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] }, status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] }, tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 50 } } }),
  'POST /v1/tasks/:taskId/comments': object({ content: { type: 'string', minLength: 1, maxLength: 5000 } }, ['content']),
  'POST /v1/docs': object({ workspaceId: id, title: { type: 'string', minLength: 1, maxLength: 500 }, parentId: id, isPublic: { type: 'boolean', default: false } }, ['workspaceId', 'title']),
  'PATCH /v1/docs/:docId': object({ title: { type: 'string', minLength: 1, maxLength: 500 }, icon: string(), parentId: nullable(id), isPublic: { type: 'boolean' } }),
  'PUT /v1/docs/:docId/blocks': object({ blocks: { type: 'array', maxItems: 5000, items: object({ id, type: { type: 'string', enum: ['paragraph', 'heading1', 'heading2', 'heading3', 'code', 'quote', 'callout', 'bulleted_list', 'numbered_list', 'todo', 'divider', 'image', 'file', 'embed', 'task_embed', 'table', 'canvas_embed'] }, content: jsonObject, order: { type: 'integer', minimum: 0 }, parentBlockId: nullable(id) }, ['id', 'type', 'content', 'order']) } }, ['blocks']),
  'POST /v1/canvases': object({ workspaceId: id, name: { type: 'string', minLength: 1, maxLength: 200 } }, ['workspaceId', 'name']),
  'POST /v1/canvases/:canvasId/nodes': ref('CanvasNode'),
  'PATCH /v1/canvases/:canvasId/nodes/:nodeId': object({ type: string(), content: jsonObject, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number', minimum: 0 }, height: { type: 'number', minimum: 0 } }),
  'POST /v1/canvases/:canvasId/nodes/:nodeId/tasks': object({ title: { type: 'string', minLength: 1, maxLength: 500 }, projectId: id }, ['title']),
  'POST /v1/ai/query': object({ question: { type: 'string', minLength: 1, maxLength: 1000 }, workspaceId: id, contextTypes: { type: 'array', items: { type: 'string', enum: ['message', 'task', 'document', 'canvas'] } } }, ['question', 'workspaceId']),
  'POST /v1/ai/summarize': object({ entityType: { type: 'string', enum: ['channel', 'document', 'task_list', 'meeting_transcript'] }, entityId: id, workspaceId: id }, ['entityType', 'entityId', 'workspaceId']),
  'POST /v1/ai/tasks/generate': object({ content: { type: 'string', minLength: 1, maxLength: 5000 }, workspaceId: id, projectId: id }, ['content', 'workspaceId']),
  'POST /v1/ai/meeting/summary': object({ transcriptId: id, workspaceId: id }, ['transcriptId']),
  'POST /v1/notifications/read-all': object({ workspaceId: id }),

  'POST /v1/bookmarks': object({ entityType: { type: 'string', enum: ['message', 'task', 'doc', 'canvas_node'] }, entityId: id, note: { type: 'string', maxLength: 500 } }, ['entityType', 'entityId']),
  'POST /v1/apikeys': object({ workspaceId: id, name: string(), scopes: array(string()), expiresAt: dateTime }, ['workspaceId', 'name']),
  'PUT /v1/workspaces/:workspaceId/llm-config': object({ endpoint: string('uri'), apiKey: string(), model: string(), enabled: { type: 'boolean', default: true } }, ['endpoint', 'apiKey']),
  'PATCH /v1/admin/:workspaceId/members/:userId': object({ role: { type: 'string', enum: ['member', 'admin'] }, status: { type: 'string', enum: ['active', 'suspended'] } }),
  'POST /v1/threads': object({ messageId: id, content: { type: 'string', minLength: 1, maxLength: 10000 } }, ['messageId', 'content']),
  'POST /v1/super-admin/workspaces/:workspaceId/suspend': object({ reason: { type: 'string', minLength: 1, maxLength: 500 } }, ['reason']),
  'PATCH /v1/super-admin/workspaces/:workspaceId/plan': object({ plan: { type: 'string', enum: ['free', 'pro', 'business', 'enterprise'] } }, ['plan']),
  'POST /v1/super-admin/users/:userId/suspend': object({ reason: { type: 'string', minLength: 1, maxLength: 500 } }, ['reason']),
  'POST /v1/super-admin/users/:userId/super-admin': object({ grant: { type: 'boolean' } }, ['grant']),
  'POST /v1/webhooks': object({ workspaceId: id, url: string('uri'), events: array(string()) }, ['workspaceId', 'url', 'events']),
  'POST /v1/scim/:workspaceId/token': object({ description: { type: 'string', minLength: 1, maxLength: 100 } }, ['description']),
  'POST /v1/video/token': object({ channelId: id }, ['channelId']),
  'POST /v1/video/:channelId/transcript': object({ text: { type: 'string', minLength: 1, maxLength: 2000 } }, ['text']),
  'PUT /v1/notifications/preferences': object({ mentions: { type: 'boolean' }, threadReplies: { type: 'boolean' }, taskAssigned: { type: 'boolean' }, taskUpdates: { type: 'boolean' }, weeklyDigest: { type: 'boolean' }, emailNotifications: { type: 'boolean' }, pushEnabled: { type: 'boolean' } }),
  'POST /v1/sso/:workspaceSlug/callback': object({ SAMLResponse: string(), RelayState: string() }, ['SAMLResponse']),
  'PUT /v1/sso/:workspaceSlug/config': object({ enabled: { type: 'boolean' }, provider: string(), entityId: string(), ssoUrl: string('uri'), certificate: string(), attributeMapping: jsonObject }, ['enabled', 'entityId', 'ssoUrl', 'certificate']),
  'POST /v1/webhooks/:endpointId/replay/:deliveryId': object({}),
  'POST /v1/super-admin/workspaces/:workspaceId/reactivate': object({}),
  'POST /v1/super-admin/users/:userId/reactivate': object({}),
  'PATCH /v1/scim/:workspaceId/Users/:userId': object({ Operations: { type: 'array', items: object({ op: string(), path: string(), value: {} }, ['op']) } }, ['Operations']),
  'POST /v1/scim/:workspaceId/Users': object({ userName: string('email'), emails: { type: 'array', items: object({ value: string('email'), primary: { type: 'boolean' } }, ['value']) }, name: object({ formatted: string(), displayName: string() }), active: { type: 'boolean' } }),
  'POST /v1/upload': object({ workspaceId: id, file: { type: 'string', format: 'binary' } }, ['workspaceId', 'file']),
}

const querySchemas: Record<string, JsonSchema> = {
  'GET /v1/workspaces': object({}),
  'GET /v1/channels': object({ workspaceId: id }, ['workspaceId']),
  'GET /v1/channels/:channelId/messages': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, before: dateTime, after: dateTime }),
  'GET /v1/tasks': object({ workspaceId: id, projectId: id, assigneeId: id, status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] }, priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] }, cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, orderBy: { type: 'string', enum: ['createdAt', 'dueDate', 'priority', 'updatedAt'], default: 'createdAt' }, order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } }, ['workspaceId']),
  'GET /v1/search': object({ q: { type: 'string', minLength: 1, maxLength: 200 }, workspaceId: id, types: string(), limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }, mode: { type: 'string', enum: ['fulltext', 'semantic', 'hybrid'], default: 'fulltext' } }, ['q', 'workspaceId']),
  'GET /v1/search/suggest': object({ q: { type: 'string', minLength: 2, maxLength: 100 }, workspaceId: id }, ['q', 'workspaceId']),
  'GET /v1/docs': object({ workspaceId: id }, ['workspaceId']),
  'GET /v1/canvases': object({ workspaceId: id }, ['workspaceId']),
  'GET /v1/threads/:threadId/messages': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }),
  'GET /v1/admin/:workspaceId/audit-log': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }),
  'GET /v1/admin/:workspaceId/members': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, status: { type: 'string', enum: ['active', 'suspended', 'invited', 'left'] } }),
  'GET /v1/workspaces/:workspaceId/members': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }),
  'GET /v1/webhooks': object({ workspaceId: id }, ['workspaceId']),
  'GET /v1/webhooks/:endpointId/deliveries': object({ limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }),
  'GET /v1/workspaces/:workspaceId/audit-log': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }),
  'GET /v1/notifications': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 }, unreadOnly: { type: 'boolean' }, workspaceId: id }),
  'GET /v1/bookmarks': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }),
  'GET /v1/apikeys': object({ workspaceId: id }, ['workspaceId']),
  'GET /v1/apikeys/': object({ workspaceId: id }, ['workspaceId']),
  'GET /v1/threads/:threadId': object({}),
  'GET /v1/super-admin/workspaces': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 }, search: string(), plan: string(), status: string() }),
  'GET /v1/super-admin/users': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 }, search: string(), status: { type: 'string', enum: ['active', 'suspended', 'deleted'] } }),
  'GET /v1/super-admin/audit-log': object({ cursor: string(), limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, action: string(), targetWorkspaceId: id, targetUserId: id }),
}

const success = (status: number, schema: JsonSchema): Record<number, JsonSchema> => ({ [status]: schema })
const noContent = { description: 'No content' }

const responseFor = (method: string, path: string): { status: number; schema?: JsonSchema; description?: string } => {
  if (method === 'DELETE' || path.endsWith('/join') || path.endsWith('/read') || path.endsWith('/leave') || path.endsWith('/read-all')) return { status: 204 }
  if (path === '/v1/sso/:workspaceSlug' || path === '/v1/sso/:workspaceSlug/callback') return { status: 302, description: 'Redirect to the identity provider or application callback.' }
  if (method === 'GET' && path === '/v1/workspaces') return { status: 200, schema: list('WorkspaceMembership') }
  if (path === '/v1/workspaces' && method === 'POST') return { status: 201, schema: ref('Workspace') }
  if (path === '/v1/workspaces/:workspaceId/members') return { status: 200, schema: paginated('WorkspaceMember') }
  if (path === '/v1/workspaces/:workspaceId/audit-log' || path === '/v1/admin/:workspaceId/audit-log') return { status: 200, schema: paginated('AuditLogEntry') }
  if (path === '/v1/admin/:workspaceId/overview') return { status: 200, schema: object({ members: { type: 'integer' }, channels: { type: 'integer' }, tasks: { type: 'integer' }, docs: { type: 'integer' }, messagesLast30Days: { type: 'integer' }, tasksByStatus: array(object({ status: string(), count: { type: 'integer' } }, ['status', 'count'])) }) }
  if (path === '/v1/admin/:workspaceId/members') return { status: 200, schema: paginated('WorkspaceMember') }
  if (path === '/v1/workspaces/:workspaceId/llm-config') return { status: 200, schema: ref('WorkspaceConfig') }
  if (path === '/v1/workspaces/invite/:token') return { status: 200, schema: jsonObject }
  if (path === '/v1/workspaces/invite/:token/accept') return { status: 200, schema: ref('WorkspaceMembership') }
  if (path === '/v1/channels' && method === 'GET') return { status: 200, schema: list('Channel') }
  if (path === '/v1/channels/:channelId/messages') return { status: 200, schema: paginated('Message') }
  if (path.startsWith('/v1/channels')) return { status: method === 'POST' ? 201 : 200, schema: ref('Channel') }
  if (path === '/v1/messages/:messageId/reactions') return { status: 200, schema: object({ reactions: list('MessageReaction') }, ['reactions']) }
  if (path === '/v1/messages/:messageId/tasks') return { status: 201, schema: ref('Task') }
  if (path.startsWith('/v1/messages')) return { status: method === 'POST' ? 201 : 200, schema: ref('Message') }
  if (path === '/v1/tasks' && method === 'GET') return { status: 200, schema: paginated('Task') }
  if (path === '/v1/tasks/:taskId/comments') return { status: 201, schema: ref('TaskComment') }
  if (path.startsWith('/v1/tasks')) return { status: method === 'POST' ? 201 : 200, schema: ref('Task') }
  if (path === '/v1/docs' && method === 'GET') return { status: 200, schema: list('Document') }
  if (path === '/v1/docs/:docId/blocks') return { status: 200, schema: list('DocumentBlock') }
  if (path.startsWith('/v1/docs')) return { status: method === 'POST' ? 201 : 200, schema: ref('Document') }
  if (path === '/v1/canvases' && method === 'GET') return { status: 200, schema: list('Canvas') }
  if (path === '/v1/canvases/:canvasId' && method === 'GET') return { status: 200, schema: ref('CanvasWithNodes') }
  if (path.includes('/nodes')) return { status: method === 'POST' ? 201 : 200, schema: path.endsWith('/tasks') ? ref('Task') : ref('CanvasNode') }
  if (path.startsWith('/v1/canvases')) return { status: method === 'POST' ? 201 : 200, schema: ref('Canvas') }
  if (path === '/v1/auth/register' || path === '/v1/auth/login') return { status: path.endsWith('/register') ? 201 : 200, schema: ref('AuthSession') }
  if (path === '/v1/auth/refresh' || path === '/v1/auth/sso/exchange') return { status: 200, schema: ref('TokenPair') }
  if (path === '/v1/auth/me') return { status: 200, schema: ref('User') }
  if (path === '/v1/auth/me/erasure-request') return { status: 200, schema: object({ requestId: id, status: { type: 'string', enum: ['completed', 'pending', 'failed'] }, message: string() }, ['requestId', 'status', 'message']) }
  if (path === '/v1/auth/logout') return { status: 204 }
  if (path === '/v1/auth/forgot-password' || path === '/v1/auth/reset-password') return { status: 200, schema: object({ message: string() }, ['message']) }
  if (path === '/v1/workspaces/:workspaceId/invite') return { status: 201, schema: object({ id, email: string('email'), role: string(), status: string() }, ['id', 'email', 'role', 'status']) }
  if (path === '/v1/workspaces/:workspaceId/import/csv') return { status: 201, schema: jsonObject }
  if (path.startsWith('/v1/workspaces')) return { status: method === 'POST' ? 201 : 200, schema: ref('Workspace') }
  if (path.startsWith('/v1/bookmarks')) return { status: method === 'POST' ? 201 : 200, schema: method === 'GET' ? list('Bookmark') : ref('Bookmark') }
  if (path.startsWith('/v1/apikeys')) return { status: method === 'POST' ? 201 : 200, schema: method === 'GET' ? list('ApiKey') : ref('ApiKey') }
  if (path === '/v1/notifications/preferences') return { status: 200, schema: ref('NotificationPreferences') }
  if (path.startsWith('/v1/notifications')) return { status: 200, schema: method === 'GET' ? object({ data: list('Notification'), meta: ref('PaginationMeta'), unreadCount: { type: 'integer' } }, ['data', 'meta', 'unreadCount']) : jsonObject }
  if (path === '/v1/bookmarks') return { status: 200, schema: list('Bookmark') }
  if (path === '/v1/apikeys') return { status: 200, schema: list('ApiKey') }
  if (path.startsWith('/v1/bookmarks')) return { status: 201, schema: ref('Bookmark') }
  if (path === '/v1/apikeys' && method === 'POST') return { status: 201, schema: ref('ApiKey') }
  if (path.startsWith('/v1/apikeys')) return { status: 200, schema: ref('ApiKey') }
  if (path === '/v1/threads/:threadId/messages') return { status: 200, schema: paginated('Message') }
  if (path.startsWith('/v1/threads')) return { status: method === 'POST' ? 201 : 200, schema: ref('Thread') }
  if (path === '/v1/search') return { status: 200, schema: paginated('SearchResult') }
  if (path === '/v1/search/suggest') return { status: 200, schema: list('SearchResult') }
  if (path.startsWith('/v1/ai')) return { status: path.endsWith('/meeting/summary') ? 202 : 200, schema: jsonObject }
  if (path === '/v1/webhooks/:endpointId/replay/:deliveryId') return { status: 202, schema: object({ message: string() }, ['message']) }
  if (path.startsWith('/v1/webhooks')) return { status: method === 'POST' ? 201 : 200, schema: method === 'GET' && path === '/v1/webhooks' ? list('WebhookEndpoint') : ref('WebhookEndpoint') }
  if (path.startsWith('/v1/sso')) return { status: method === 'PUT' ? 200 : 200, schema: ref('SsoConfig') }
  if (path.startsWith('/v1/scim')) return { status: method === 'DELETE' ? 204 : method === 'POST' ? 201 : 200, schema: ref('ScimUser') }
  if (path === '/v1/video/:channelId/transcript') return { status: 201, description: 'Transcript segment accepted.' }
  if (path === '/v1/video/token') return { status: 200, schema: ref('VideoToken') }
  if (path === '/v1/video/:channelId/participants') return { status: 200, schema: ref('VideoParticipants') }
  if (path.startsWith('/v1/video')) return { status: 200, schema: jsonObject }
  if (path.startsWith('/v1/scim/') && path.endsWith('/token')) return { status: 201, schema: ref('ScimToken') }
  if (path.endsWith('/Users') && method === 'GET') return { status: 200, schema: ref('ScimList') }
  if (path.includes('/Users/')) return { status: method === 'DELETE' ? 204 : 200, schema: ref('ScimUser') }
  if (path.endsWith('/Users') && method === 'POST') return { status: 201, schema: ref('ScimUser') }
  if (path.startsWith('/v1/scim/')) return { status: 200, schema: ref('ScimUser') }
  if (path === '/v1/webhooks/:endpointId/replay/:deliveryId') return { status: 202, schema: object({ queued: { type: 'boolean' } }, ['queued']) }
  if (path.startsWith('/v1/super-admin')) return { status: 200, schema: jsonObject }
  if (path.startsWith('/v1/admin')) return { status: 200, schema: jsonObject }
  if (path.startsWith('/v1/')) return { status: method === 'POST' ? 201 : 200, schema: jsonObject }
  return { status: 200, schema: jsonObject }
}

export const documentRoute = ({ schema = {}, url, route }: {
  schema?: Record<string, any>
  url: string
  route: { method: string | string[] }
}) => {
  const method = (Array.isArray(route.method) ? route.method[0] : route.method)?.toUpperCase() ?? 'GET'
  const path = url.split('?')[0]!.replace(/\/$/, '') || '/'
  const params = [...path.matchAll(/:([^/]+)/g)].map((match) => match[1]!)
  const resource = path.split('/').filter(Boolean).find((part) => part !== 'v1') ?? 'api'
  const tag = resource.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  const operationId = `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`
  const operationKey = `${method} ${path}`
  const response = responseFor(method, path)
  const publicOperation = [
    'POST /v1/auth/register', 'POST /v1/auth/login', 'POST /v1/auth/refresh',
    'POST /v1/auth/forgot-password', 'POST /v1/auth/reset-password', 'POST /v1/auth/sso/exchange',
    'GET /v1/sso/status', 'GET /v1/workspaces/invite/:token', 'POST /v1/workspaces/invite/:token/accept',
    'GET /v1/health',
  ].includes(operationKey) || path === '/v1/sso/:workspaceSlug' || path === '/v1/sso/:workspaceSlug/callback'
  const errors = Object.fromEntries([400, 401, 403, 404, 409, 429, 500].map((status) => [status, ref('ApiError')]))
  const responseSchemas = {
    ...errors,
    [response.status]: response.status === 204
      ? noContent
      : response.description
        ? { description: response.description }
        : response.schema ?? ref('JsonObject'),
  }
  const scimProtocolRoute = path.startsWith('/v1/scim/') && !path.endsWith('/token')
  const isBodyRequest = ['POST', 'PUT', 'PATCH'].includes(method)
    && !path.endsWith('/join') && !path.endsWith('/read') && !path.endsWith('/leave') && !path.endsWith('/read-all')

  const documentedSchema = {
    ...schema,
    tags: schema.tags ?? [tag],
    operationId: schema.operationId ?? operationId,
    summary: schema.summary ?? `${method} ${path}`,
    security: schema.security ?? (scimProtocolRoute ? [{ scimBearerAuth: [] }] : publicOperation ? [] : undefined),
    params: schema.params ?? (params.length ? {
      type: 'object', required: params,
      properties: Object.fromEntries(params.map((name) => [name, { type: 'string' }])),
    } : undefined),
    querystring: schema.querystring ?? querySchemas[operationKey] ?? { type: 'object', properties: {} },
    body: schema.body ?? bodySchemas[operationKey] ?? (isBodyRequest ? jsonObject : undefined),
    ...(operationKey === 'POST /v1/sso/:workspaceSlug/callback' ? { consumes: ['application/x-www-form-urlencoded'] } : {}),
    ...(path === '/v1/upload' ? { consumes: ['multipart/form-data'] } : {}),
    response: { ...responseSchemas, ...schema.response },
  }
  return { schema: documentedSchema, url }
}
