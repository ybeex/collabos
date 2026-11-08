-- Super admin platform-wide trust tier + dedicated audit log.
-- Deliberately independent of WorkspaceMember.role: this flag carries no
-- workspace-membership implication and no workspace role carries platform
-- authority. See schema.prisma comment on User.isSuperAdmin for the full
-- rationale.

ALTER TABLE "users" ADD COLUMN "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- Platform-level workspace suspension, independent of deleted_at (see
-- schema.prisma comment on Workspace.suspendedAt for full rationale).
ALTER TABLE "workspaces" ADD COLUMN "suspended_at" TIMESTAMP(3);
ALTER TABLE "workspaces" ADD COLUMN "suspended_reason" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "suspended_by_id" TEXT;
CREATE INDEX "workspaces_suspended_at_idx" ON "workspaces" ("suspended_at");

-- Index to make "list all super admins" (used by the super admin
-- management page itself) a fast lookup rather than a full table scan,
-- since this table is expected to remain small (platform operators, not
-- end users) but the users table as a whole will not.
CREATE INDEX "users_is_super_admin_idx" ON "users" ("is_super_admin") WHERE "is_super_admin" = true;

CREATE TYPE "SuperAdminAction" AS ENUM (
  'workspace_suspended',
  'workspace_reactivated',
  'workspace_plan_changed',
  'workspace_deleted',
  'user_suspended',
  'user_reactivated',
  'user_impersonation_started',
  'user_impersonation_ended',
  'super_admin_granted',
  'super_admin_revoked',
  'system_setting_changed'
);

-- No foreign keys on target_workspace_id / target_user_id by design — this
-- log must remain a complete record even after the workspace or user it
-- describes is hard-deleted. actor_email is denormalized for the same
-- reason on the actor side.
CREATE TABLE "super_admin_audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "actor_email" TEXT NOT NULL,
  "action" "SuperAdminAction" NOT NULL,
  "target_workspace_id" TEXT,
  "target_user_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "ip_address" TEXT NOT NULL,
  "user_agent" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "super_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "super_admin_audit_logs_actor_id_created_at_idx" ON "super_admin_audit_logs" ("actor_id", "created_at" DESC);
CREATE INDEX "super_admin_audit_logs_target_workspace_id_idx" ON "super_admin_audit_logs" ("target_workspace_id");
CREATE INDEX "super_admin_audit_logs_target_user_id_idx" ON "super_admin_audit_logs" ("target_user_id");
CREATE INDEX "super_admin_audit_logs_action_created_at_idx" ON "super_admin_audit_logs" ("action", "created_at" DESC);

-- Operator note: there is intentionally NO self-service way to become a
-- super admin anywhere in the application. The very first super admin on
-- any deployment must be granted directly via SQL:
--   UPDATE users SET is_super_admin = true WHERE email = 'you@example.com';
-- Every subsequent grant/revoke goes through POST/DELETE
-- /v1/super-admin/admins/:userId, which requires an existing super admin
-- to call it and is fully logged in super_admin_audit_logs.
