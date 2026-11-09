-- Migration 0004: Add conversation_summaries and last_read_at
BEGIN;

-- 1. Add last_read_at column to memberships if missing
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- Backfill last_read_at from last_read_message_id if exists
UPDATE memberships m
SET last_read_at = msg.created_at
FROM messages msg
WHERE m.last_read_message_id = msg.id
  AND m.last_read_at IS NULL;

-- 2. Create conversation_summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL,
  from_ts         TIMESTAMPTZ NOT NULL,
  to_ts           TIMESTAMPTZ NOT NULL,
  messages_hash   TEXT NOT NULL,
  summary_json    JSONB NOT NULL,
  model           TEXT NOT NULL,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient cache lookups, company tenancy, and cleanup
CREATE INDEX IF NOT EXISTS conv_summaries_conv_range_hash_idx
  ON conversation_summaries(conversation_id, from_ts, to_ts, messages_hash);

CREATE INDEX IF NOT EXISTS conv_summaries_company_id_idx
  ON conversation_summaries(company_id);

CREATE INDEX IF NOT EXISTS conv_summaries_created_at_idx
  ON conversation_summaries(created_at);

-- 3. Row-level security for tenant isolation
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON conversation_summaries;
CREATE POLICY company_isolation ON conversation_summaries
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

COMMIT;
