-- PRD_AUDIT.md Finding #1: adds real CRDT storage for document editing,
-- closing the gap where docs/index.ts previously did last-write-wins full
-- block replacement while a comment falsely claimed CRDT deltas were
-- handled at the WebSocket layer.

CREATE TABLE "document_yjs_state" (
  "id"          TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "state"       BYTEA,
  "s3_key"      TEXT,
  "size_bytes"  INTEGER NOT NULL DEFAULT 0,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_yjs_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_yjs_state_document_id_key" ON "document_yjs_state" ("document_id");

ALTER TABLE "document_yjs_state"
  ADD CONSTRAINT "document_yjs_state_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
