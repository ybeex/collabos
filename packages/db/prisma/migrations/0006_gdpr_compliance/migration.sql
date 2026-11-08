-- PRD_AUDIT.md Finding #7: PRD §19 GDPR compliance — data residency
-- selection at workspace creation, and a right-to-erasure record.

CREATE TYPE "DataResidency" AS ENUM ('us', 'eu', 'apac');

ALTER TABLE "workspaces" ADD COLUMN "data_residency" "DataResidency" NOT NULL DEFAULT 'us';

CREATE TABLE "erasure_requests" (
  "id"               TEXT NOT NULL,
  "user_id"          TEXT NOT NULL,
  "requester_email"  TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "requested_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"     TIMESTAMP(3),
  "notes"            TEXT,

  CONSTRAINT "erasure_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "erasure_requests_user_id_idx" ON "erasure_requests" ("user_id");
CREATE INDEX "erasure_requests_status_idx" ON "erasure_requests" ("status");
