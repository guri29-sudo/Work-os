-- Migration 0003: Add object_reference_ids column to messages table
BEGIN;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS object_reference_ids UUID[] NOT NULL DEFAULT '{}';

COMMIT;