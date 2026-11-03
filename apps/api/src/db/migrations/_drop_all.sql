DO $DROP$ DECLARE r RECORD; BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS '||quote_ident(r.tablename)||' CASCADE';
  END LOOP;
END $DROP$;
DROP TYPE IF EXISTS conversation_type CASCADE;
DROP TYPE IF EXISTS channel_kind CASCADE;
DROP TYPE IF EXISTS member_role CASCADE;
DROP TYPE IF EXISTS notification_pref CASCADE;
DROP TYPE IF EXISTS attachment_scan_status CASCADE;
DROP TYPE IF EXISTS webhook_event_type CASCADE;
DROP TYPE IF EXISTS audit_action CASCADE;
DROP TYPE IF EXISTS webhook_delivery_status CASCADE;
DROP FUNCTION IF EXISTS current_company_id() CASCADE;
DROP FUNCTION IF EXISTS messages_search_vector_update() CASCADE;
DROP FUNCTION IF EXISTS messages_update_reply_count() CASCADE;
DROP FUNCTION IF EXISTS audit_log_immutable() CASCADE;
