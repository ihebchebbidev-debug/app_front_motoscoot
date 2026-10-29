-- =====================================================
-- Migration 018 — Intelligent reference: brand ↔ vehicle category links
--
-- Until now, the only way to know which brands belong to which vehicle
-- category was to look at their `models.category` rows. That worked for
-- read-side queries but had three problems:
--   1. A brand with no models seeded (e.g. brand-new accessory line) was
--      invisible to the type→brand filter.
--   2. A brand selling both Motos and Scooters (e.g. SYM, Piaggio) was
--      classified by whichever model row was queried first.
--   3. Admins had no way to override this in the dashboard.
--
-- This migration introduces an explicit join table so admins can curate
-- which categories each brand serves. The table is back-filled from the
-- distinct `models.category` values to keep current behavior intact.
--
-- Idempotent: safe to re-run.
-- =====================================================

CREATE TABLE IF NOT EXISTS brand_categories (
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category TEXT    NOT NULL,
  PRIMARY KEY (brand_id, category)
);

CREATE INDEX IF NOT EXISTS idx_brand_categories_category
  ON brand_categories (category);

-- Back-fill from existing models.category links so the new join table
-- mirrors the inferred mapping. Skip NULL/empty categories.
INSERT INTO brand_categories (brand_id, category)
SELECT DISTINCT m.brand_id, m.category
  FROM models m
 WHERE m.category IS NOT NULL AND TRIM(m.category) <> ''
ON CONFLICT DO NOTHING;