-- ============================================================
-- 029_dev_tickets.sql
-- Internal "developer tickets" board used by admins to file bug
-- reports / feature requests with the developer. Each ticket has
-- a title, a long description, an optional screenshot, a status
-- workflow (nouveau → en_cours → done | refuse) and the user that
-- created it. Visible only to admins via /api/admin/dev-tickets.
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
