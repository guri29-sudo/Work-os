-- Migration 0001: Initial schema
-- Run by: apps/api/src/db/migrate.ts
-- Every tenant table has company_id. RLS is enabled as defense-in-depth.
-- audit_log is append-only enforced by trigger.
-- messages unique(author_id, conversation_id, client_msg_id) enables idempotent send.

BEGIN;

-- --- Extensions --------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --- Enums -------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE conversation_type AS ENUM ('dm','group_dm','channel');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE channel_kind AS ENUM ('company','department','project','public','private','announcement');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('owner','admin','member');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE notification_pref AS ENUM ('all','mentions','nothing');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE attachment_scan_status AS ENUM ('pending','clean','infected','error');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE webhook_event_type AS ENUM ('message.created','message.updated','message.deleted','mention.created','channel.created','channel.archived','member.added','member.removed','moderation.action');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM ('channel.created','channel.updated','channel.archived','channel.unarchived','member.added','member.removed','member.role_changed','message.moderated','message.restored','attachment.deleted','break_glass.accessed','webhook.created','webhook.deleted','webhook.updated','audit_log.read');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE webhook_delivery_status AS ENUM ('pending','delivered','failed','dead_letter');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --- users -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  company_id    UUID NOT NULL,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  department_ids UUID[] NOT NULL DEFAULT '{}',
  project_ids   UUID[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_company_id_idx ON users(company_id);

-- --- conversations ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL,
  type                 conversation_type NOT NULL,
  kind                 channel_kind,
  name                 TEXT,
  topic                TEXT,
  is_archived          BOOLEAN NOT NULL DEFAULT FALSE,
  is_announcement_only BOOLEAN NOT NULL DEFAULT FALSE,
  department_id        UUID,
  project_id           UUID,
  member_count         INTEGER NOT NULL DEFAULT 0,
  last_message_at      TIMESTAMPTZ,
  created_by           UUID NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversations_company_id_idx    ON conversations(company_id);
CREATE INDEX IF NOT EXISTS conversations_company_type_idx  ON conversations(company_id, type);

-- --- memberships -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memberships (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id      UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL,
  company_id           UUID NOT NULL,
  role                 member_role NOT NULL DEFAULT 'member',
  last_read_message_id UUID,
  notification_pref    notification_pref NOT NULL DEFAULT 'all',
  is_muted             BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_conversation_user_uidx ON memberships(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS memberships_user_company_idx  ON memberships(user_id, company_id);
CREATE INDEX IF NOT EXISTS memberships_company_id_idx    ON memberships(company_id);

-- --- message_seq_counters -----------------------------------------------------
CREATE TABLE IF NOT EXISTS message_seq_counters (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  last_seq        BIGINT NOT NULL DEFAULT 0
);

-- --- messages -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL,
  author_id       UUID NOT NULL,
  client_msg_id   UUID NOT NULL,
  seq             BIGINT NOT NULL,
  body            TEXT NOT NULL,
  parent_id       UUID REFERENCES messages(id),
  reply_count     INTEGER NOT NULL DEFAULT 0,
  attachment_ids  UUID[] NOT NULL DEFAULT '{}',
  mention_ids     UUID[] NOT NULL DEFAULT '{}',
  search_vector   TSVECTOR,
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_conv_seq_idx     ON messages(conversation_id, seq);
CREATE INDEX IF NOT EXISTS messages_company_id_idx   ON messages(company_id);
CREATE INDEX IF NOT EXISTS messages_parent_id_idx    ON messages(parent_id);
CREATE INDEX IF NOT EXISTS messages_search_gin_idx   ON messages USING GIN(search_vector);
-- IDEMPOTENCY: unique per (author, conversation, client_msg_id)
CREATE UNIQUE INDEX IF NOT EXISTS messages_idempotency_uidx
  ON messages(author_id, conversation_id, client_msg_id);

-- Trigger: maintain search_vector from body
CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.body, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_search_vector_trig ON messages;
CREATE TRIGGER messages_search_vector_trig
  BEFORE INSERT OR UPDATE OF body ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_search_vector_update();

-- Trigger: increment reply_count on parent when a thread reply is inserted
CREATE OR REPLACE FUNCTION messages_update_reply_count() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE messages SET reply_count = reply_count + 1
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_reply_count_trig ON messages;
CREATE TRIGGER messages_reply_count_trig
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_update_reply_count();

-- --- reactions ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  company_id      UUID NOT NULL,
  user_id         UUID NOT NULL,
  emoji           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS reactions_unique_uidx ON reactions(message_id, user_id, emoji);
CREATE INDEX IF NOT EXISTS reactions_company_id_idx ON reactions(company_id);

-- --- attachments --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL,
  message_id       UUID,
  uploader_id      UUID NOT NULL,
  filename         TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  size_bytes       BIGINT NOT NULL,
  checksum_sha256  TEXT NOT NULL,
  storage_key      TEXT NOT NULL,
  scan_status      attachment_scan_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS attachments_company_id_idx  ON attachments(company_id);
CREATE INDEX IF NOT EXISTS attachments_message_id_idx  ON attachments(message_id);

-- --- object_references -------------------------------------------------------
CREATE TABLE IF NOT EXISTS object_references (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL,
  message_id       UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  object_type      TEXT NOT NULL,
  object_id        TEXT NOT NULL,
  display_title    TEXT NOT NULL,
  display_subtitle TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS obj_refs_company_id_idx ON object_references(company_id);

-- --- drafts -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id         UUID NOT NULL,
  company_id      UUID NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS drafts_conv_user_uidx ON drafts(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS drafts_company_id_idx ON drafts(company_id);

-- --- notifications ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  company_id      UUID NOT NULL,
  kind            TEXT NOT NULL,
  conversation_id UUID NOT NULL,
  message_id      UUID,
  actor_id        UUID,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_company_idx ON notifications(user_id, company_id);
CREATE INDEX IF NOT EXISTS notifications_company_id_idx   ON notifications(company_id);

-- --- audit_log (APPEND-ONLY) --------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL,
  actor_id      UUID NOT NULL,
  action        audit_action NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_company_id_idx      ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS audit_log_company_created_idx ON audit_log(company_id, created_at);

-- Trigger: block UPDATE and DELETE on audit_log (append-only enforcement)
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update_trig ON audit_log;
CREATE TRIGGER audit_log_no_update_trig
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- --- idempotency_keys ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  key             TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body   JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_key_uidx ON idempotency_keys(company_id, key);
CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx ON idempotency_keys(expires_at);

-- --- webhook_endpoints --------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL,
  url         TEXT NOT NULL,
  description TEXT,
  events      webhook_event_type[] NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_company_id_idx ON webhook_endpoints(company_id);

-- --- webhook_deliveries -------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id       UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL,
  event_id          UUID NOT NULL,
  event_type        webhook_event_type NOT NULL,
  payload           JSONB NOT NULL,
  status            webhook_delivery_status NOT NULL DEFAULT 'pending',
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  next_retry_at     TIMESTAMPTZ,
  response_status   INTEGER,
  response_body     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_company_id_idx  ON webhook_deliveries(company_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_next_retry_idx  ON webhook_deliveries(next_retry_at) WHERE status = 'pending';

-- --- RLS Setup ---------------------------------------------------------------
-- Enables Row-Level Security on all tenant tables as defense-in-depth.
-- The application ALWAYS sets: SET LOCAL app.company_id = '<uuid>'
-- The primary authorization check is in the repository layer.

CREATE OR REPLACE FUNCTION current_company_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.company_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Helper to apply RLS to a table
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'users','conversations','memberships','messages','reactions',
    'attachments','object_references','drafts','notifications',
    'audit_log','webhook_endpoints','webhook_deliveries',
    'idempotency_keys'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    -- Drop existing policy to allow re-runs
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON %I', tbl);
    -- Allow all operations when company_id matches the session variable
    -- or when the session variable is not set (migration/superuser context)
    EXECUTE format($POLICY$
      CREATE POLICY company_isolation ON %I
        USING (company_id = current_company_id())
        WITH CHECK (company_id = current_company_id())
    $POLICY$, tbl);
  END LOOP;
END $$;

-- message_seq_counters joins via conversations (no direct company_id)
-- RLS on it is enforced through the JOIN in the repository
ALTER TABLE message_seq_counters DISABLE ROW LEVEL SECURITY;

COMMIT;


