-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('free', 'pro', 'business', 'enterprise');
CREATE TYPE "WorkspacePlan" AS ENUM ('free', 'pro', 'business', 'enterprise');
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'member', 'guest');
CREATE TYPE "MemberStatus" AS ENUM ('active', 'invited', 'suspended', 'left');
CREATE TYPE "ChannelType" AS ENUM ('public', 'private', 'direct');
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'in_review', 'done', 'cancelled');
CREATE TYPE "TaskPriority" AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE "BlockType" AS ENUM (
  'paragraph', 'heading1', 'heading2', 'heading3', 'code', 'quote',
  'callout', 'bulleted_list', 'numbered_list', 'todo', 'divider',
  'image', 'file', 'embed', 'task_embed', 'table', 'canvas_embed'
);
CREATE TYPE "EdgeType" AS ENUM (
  'converted_from', 'referenced_in', 'mentioned_in',
  'related_to', 'produced_by', 'decided_in'
);

-- Users
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "plan" "UserPlan" NOT NULL DEFAULT 'free',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "lockedUntil" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- Workspaces
CREATE TABLE "workspaces" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "logoUrl" TEXT,
  "plan" "WorkspacePlan" NOT NULL DEFAULT 'free',
  "ownerId" TEXT NOT NULL,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
CREATE INDEX "workspaces_slug_idx" ON "workspaces"("slug");
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces"("ownerId");
CREATE INDEX "workspaces_deletedAt_idx" ON "workspaces"("deletedAt");

-- Workspace members
CREATE TABLE "workspace_members" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "MemberRole" NOT NULL DEFAULT 'member',
  "status" "MemberStatus" NOT NULL DEFAULT 'active',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspace_members_workspaceId_userId_key" UNIQUE ("workspaceId", "userId"),
  CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "workspace_members_workspaceId_status_idx" ON "workspace_members"("workspaceId", "status");
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- Workspace invites
CREATE TABLE "workspace_invites" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "MemberRole" NOT NULL DEFAULT 'member',
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "invitedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspace_invites_token_key" UNIQUE ("token"),
  CONSTRAINT "workspace_invites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "workspace_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id")
);
CREATE INDEX "workspace_invites_token_idx" ON "workspace_invites"("token");
CREATE INDEX "workspace_invites_email_idx" ON "workspace_invites"("email");
CREATE INDEX "workspace_invites_workspaceId_idx" ON "workspace_invites"("workspaceId");

-- Channels
CREATE TABLE "channels" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "ChannelType" NOT NULL DEFAULT 'public',
  "createdById" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "channels_workspaceId_name_key" UNIQUE ("workspaceId", "name"),
  CONSTRAINT "channels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);
CREATE INDEX "channels_workspaceId_deletedAt_idx" ON "channels"("workspaceId", "deletedAt");
CREATE INDEX "channels_type_idx" ON "channels"("type");

-- Channel members
CREATE TABLE "channel_members" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "lastReadAt" TIMESTAMP(3),
  "isMuted" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "channel_members_channelId_userId_key" UNIQUE ("channelId", "userId"),
  CONSTRAINT "channel_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE,
  CONSTRAINT "channel_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "channel_members_userId_idx" ON "channel_members"("userId");
CREATE INDEX "channel_members_channelId_idx" ON "channel_members"("channelId");

-- Threads
CREATE TABLE "threads" (
  "id" TEXT NOT NULL,
  "messageId" TEXT,
  "channelId" TEXT NOT NULL,
  "lastReplyAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "threads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "threads_messageId_key" UNIQUE ("messageId")
);
CREATE INDEX "threads_channelId_idx" ON "threads"("channelId");

-- Messages
CREATE TABLE "messages" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "threadId" TEXT,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE,
  CONSTRAINT "messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id"),
  CONSTRAINT "messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id")
);
CREATE INDEX "messages_channelId_createdAt_idx" ON "messages"("channelId", "createdAt" DESC);
CREATE INDEX "messages_channelId_deletedAt_idx" ON "messages"("channelId", "deletedAt");
CREATE INDEX "messages_authorId_idx" ON "messages"("authorId");
CREATE INDEX "messages_threadId_idx" ON "messages"("threadId");

-- Message reactions
CREATE TABLE "message_reactions" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_reactions_messageId_userId_emoji_key" UNIQUE ("messageId", "userId", "emoji"),
  CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE
);
CREATE INDEX "message_reactions_messageId_idx" ON "message_reactions"("messageId");

-- Attachments
CREATE TABLE "attachments" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id")
);
CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");

-- Documents
CREATE TABLE "documents" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "icon" TEXT,
  "parentId" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "lastEditedById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id"),
  CONSTRAINT "documents_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id"),
  CONSTRAINT "documents_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "documents"("id")
);
CREATE INDEX "documents_workspaceId_deletedAt_idx" ON "documents"("workspaceId", "deletedAt");
CREATE INDEX "documents_parentId_idx" ON "documents"("parentId");
CREATE INDEX "documents_updatedAt_idx" ON "documents"("updatedAt" DESC);

-- Document blocks
CREATE TABLE "document_blocks" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "type" "BlockType" NOT NULL,
  "content" JSONB NOT NULL,
  "order" DOUBLE PRECISION NOT NULL,
  "parentBlockId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_blocks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
);
CREATE INDEX "document_blocks_documentId_deletedAt_idx" ON "document_blocks"("documentId", "deletedAt");
CREATE INDEX "document_blocks_documentId_order_idx" ON "document_blocks"("documentId", "order");

-- Document versions
CREATE TABLE "document_versions" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "blocks" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE,
  CONSTRAINT "document_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id")
);
CREATE INDEX "document_versions_documentId_createdAt_idx" ON "document_versions"("documentId", "createdAt" DESC);

-- Projects
CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);
CREATE INDEX "projects_workspaceId_deletedAt_idx" ON "projects"("workspaceId", "deletedAt");

-- Tasks
CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'todo',
  "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
  "assigneeId" TEXT,
  "createdById" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id"),
  CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id"),
  CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id")
);
CREATE INDEX "tasks_workspaceId_status_deletedAt_idx" ON "tasks"("workspaceId", "status", "deletedAt");
CREATE INDEX "tasks_workspaceId_assigneeId_idx" ON "tasks"("workspaceId", "assigneeId");
CREATE INDEX "tasks_workspaceId_dueDate_idx" ON "tasks"("workspaceId", "dueDate");
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");
CREATE INDEX "tasks_createdAt_idx" ON "tasks"("createdAt" DESC);

-- Task comments
CREATE TABLE "task_comments" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE,
  CONSTRAINT "task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id")
);
CREATE INDEX "task_comments_taskId_deletedAt_idx" ON "task_comments"("taskId", "deletedAt");

-- Canvases
CREATE TABLE "canvases" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "thumbnail" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "canvases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canvases_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
);
CREATE INDEX "canvases_workspaceId_deletedAt_idx" ON "canvases"("workspaceId", "deletedAt");

-- Canvas nodes
CREATE TABLE "canvas_nodes" (
  "id" TEXT NOT NULL,
  "canvasId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION NOT NULL,
  "height" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "canvas_nodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canvas_nodes_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvases"("id") ON DELETE CASCADE
);
CREATE INDEX "canvas_nodes_canvasId_idx" ON "canvas_nodes"("canvasId");

-- Work graph nodes
CREATE TABLE "work_graph_nodes" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_graph_nodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_graph_nodes_entityId_key" UNIQUE ("entityId")
);
CREATE INDEX "work_graph_nodes_workspaceId_entityType_idx" ON "work_graph_nodes"("workspaceId", "entityType");
CREATE INDEX "work_graph_nodes_entityId_idx" ON "work_graph_nodes"("entityId");

-- Work graph edges
CREATE TABLE "work_graph_edges" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "edgeType" "EdgeType" NOT NULL,
  "createdById" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_graph_edges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_graph_edges_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
  CONSTRAINT "work_graph_edges_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id")
);
CREATE INDEX "work_graph_edges_workspaceId_sourceType_sourceId_idx" ON "work_graph_edges"("workspaceId", "sourceType", "sourceId");
CREATE INDEX "work_graph_edges_workspaceId_targetType_targetId_idx" ON "work_graph_edges"("workspaceId", "targetType", "targetId");
CREATE INDEX "work_graph_edges_edgeType_idx" ON "work_graph_edges"("edgeType");
CREATE INDEX "work_graph_edges_createdAt_idx" ON "work_graph_edges"("createdAt" DESC);

-- Audit logs
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "action" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id"),
  CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
);
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);
CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs"("workspaceId", "createdAt" DESC);
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);
