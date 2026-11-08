-- PRD_AUDIT.md Finding #2: closes the P0 gap where meeting transcription
-- and AI summarization did not exist in any form.

CREATE TABLE "call_transcripts" (
  "id"            TEXT NOT NULL,
  "channel_id"    TEXT NOT NULL,
  "call_id"       TEXT NOT NULL,
  "started_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at"      TIMESTAMP(3),
  "summary"       TEXT,
  "decisions"     JSONB,
  "action_items"  JSONB,
  "summarized_at" TIMESTAMP(3),

  CONSTRAINT "call_transcripts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_transcripts_call_id_key" ON "call_transcripts" ("call_id");
CREATE INDEX "call_transcripts_channel_id_started_at_idx" ON "call_transcripts" ("channel_id", "started_at" DESC);

ALTER TABLE "call_transcripts"
  ADD CONSTRAINT "call_transcripts_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "call_transcript_segments" (
  "id"            TEXT NOT NULL,
  "transcript_id" TEXT NOT NULL,
  "speaker_id"    TEXT NOT NULL,
  "speaker_name"  TEXT NOT NULL,
  "text"          TEXT NOT NULL,
  "spoken_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "call_transcript_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "call_transcript_segments_transcript_id_spoken_at_idx" ON "call_transcript_segments" ("transcript_id", "spoken_at" ASC);

ALTER TABLE "call_transcript_segments"
  ADD CONSTRAINT "call_transcript_segments_transcript_id_fkey"
  FOREIGN KEY ("transcript_id") REFERENCES "call_transcripts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
