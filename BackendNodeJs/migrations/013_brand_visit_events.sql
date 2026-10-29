-- ============================================================
-- 013_brand_visit_events.sql
-- Adds time-series tracking for brand visits so the admin can see
-- demand trends over time (in addition to the running total kept
-- in `brand_visits`).
--
-- Two tables:
--   brand_visit_events  — raw events (~7 day retention, GC'd)
--   brand_visit_daily   — daily rollup (long-term, ~90+ days)
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_visit_events (
  id          BIGSERIAL PRIMARY KEY,
  brand       VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_visit_events_created
  ON brand_visit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_visit_events_brand_created
  ON brand_visit_events (brand, created_at DESC);

CREATE TABLE IF NOT EXISTS brand_visit_daily (
  brand   VARCHAR(100) NOT NULL,
  day     DATE         NOT NULL,
  visits  INTEGER      NOT NULL DEFAULT 0,
  PRIMARY KEY (brand, day)
);

CREATE INDEX IF NOT EXISTS idx_brand_visit_daily_day
  ON brand_visit_daily (day DESC);
