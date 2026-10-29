-- ============================================================
-- 004_brand_visits.sql
-- Adds the brand_visits table used by tech-specs popularity
-- ranking and brand visit tracking.
--
-- Bug fixed: GET /api/tech-specs/popular and POST
-- /api/tech-specs/:id/visit returned 500 because this table
-- was referenced by the controller but never created.
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_visits (
  brand   VARCHAR(100) PRIMARY KEY,
  visits  INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_visits_visits
  ON brand_visits (visits DESC);
