-- ============================================================
-- 030_dev_tickets_pgcrypto.sql
-- Safety-net migration for the developer ticket board.
--
-- Two problems fixed here, both of which silently break ticket
-- creation in production (the request returns 500 and the global
-- error handler masks the cause as "Internal server error"):
--
-- 1. `pgcrypto` provides `gen_random_uuid()` used by the
--    dev_tickets PRIMARY KEY default. On Postgres ≤ 12 — and on
--    some managed DBs that don't enable extensions by default —
--    the function is missing and INSERT fails. Enabling the
--    extension is idempotent.
--
-- 2. If a previous deploy never ran migration 029 (e.g. the
--    operator forgot `npm run migrate`), this re-creates the
--    table so the feature works. Both statements are
--    `IF NOT EXISTS`, so re-running is a no-op.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS dev_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  image_url   TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'nouveau'
              CHECK (status IN ('nouveau','en_cours','done','refuse')),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_tickets_status_created
  ON dev_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dev_tickets_created_at
  ON dev_tickets (created_at DESC);
