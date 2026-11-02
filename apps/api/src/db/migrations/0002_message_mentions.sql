-- Migration 0002: Message Mentions table
BEGIN;

CREATE TABLE IF NOT EXISTS message_mentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_mentions_unique_uidx ON message_mentions(message_id, user_id);
CREATE INDEX IF NOT EXISTS message_mentions_user_conv_idx     ON message_mentions(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS message_mentions_company_idx       ON message_mentions(company_id);

ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_mentions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_isolation ON message_mentions;
CREATE POLICY company_isolation ON message_mentions
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON message_mentions TO app_user;
  END IF;
END $$;

COMMIT;
