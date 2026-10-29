-- =====================================================
-- Migration 006 — view dedupe table + boost expiry job
-- Idempotent: safe to re-run.
-- =====================================================

-- Per-IP / per-user dedupe table for listing views.
-- Prevents bots and rapid refreshes from inflating views_count.
--
-- NOTE: migration 001 already creates `listing_views` with a
-- `fingerprint` column (no `ip`). We reconcile both shapes here
-- so this file can run on fresh databases AND on databases that
-- were initialised with migration 001 first.
CREATE TABLE IF NOT EXISTS listing_views (
  id          BIGSERIAL PRIMARY KEY,
  listing_id  UUID NOT NULL,
  user_id     UUID,
  ip          VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill columns that may be missing if the table was created by 001.
ALTER TABLE listing_views
  ADD COLUMN IF NOT EXISTS ip          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS user_id     UUID,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_ip_time
  ON listing_views (listing_id, ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_views_listing_user_time
  ON listing_views (listing_id, user_id, created_at DESC);

-- Garbage-collect rows older than 30 days (keeps the dedupe window light).
-- We don't schedule pg_cron here — server.js runs the cleanup periodically.

-- Add ends_at column on listing_boosts if missing, so the
-- expiry job can clear is_featured = true once a boost expires.
ALTER TABLE listing_boosts
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_listing_boosts_ends_at
  ON listing_boosts (ends_at) WHERE ends_at IS NOT NULL;
