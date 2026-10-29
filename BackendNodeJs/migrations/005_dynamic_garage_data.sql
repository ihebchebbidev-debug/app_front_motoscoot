-- =====================================================
-- Migration 005 — Dynamic garage data
-- Adds columns the frontend already maps but that were
-- missing from the original schema (slug, cover image,
-- structured opening hours, status, services as JSONB).
-- Idempotent — safe to re-run.
-- =====================================================

-- ---- Enable unaccent extension (best-effort) ----
-- Some managed Postgres deployments restrict CREATE EXTENSION; ignore failure.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS unaccent;
EXCEPTION WHEN insufficient_privilege OR undefined_file THEN
  -- Will fall back to plain text in unaccent_safe()
  NULL;
END$$;

-- ---- Helper: tolerate missing unaccent extension by falling back to plain text ----
-- MUST be defined BEFORE the UPDATE below that calls it.
CREATE OR REPLACE FUNCTION unaccent_safe(txt text) RETURNS text AS $$
BEGIN
  RETURN unaccent(txt);
EXCEPTION WHEN undefined_function THEN
  RETURN txt;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---- garages: new columns ----
ALTER TABLE garages
  ADD COLUMN IF NOT EXISTS slug          VARCHAR(220) UNIQUE,
  ADD COLUMN IF NOT EXISTS cover_image   TEXT,
  ADD COLUMN IF NOT EXISTS logo          TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status        VARCHAR(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS services      JSONB DEFAULT '[]'::jsonb;

-- ---- garage_reviews: owner reply (already shipped in 002 but kept defensive) ----
ALTER TABLE garage_reviews
  ADD COLUMN IF NOT EXISTS owner_reply    TEXT,
  ADD COLUMN IF NOT EXISTS owner_reply_at TIMESTAMPTZ;

-- ---- Backfill slug from name (slugify, ASCII-only, dedupe with id suffix if needed) ----
UPDATE garages
   SET slug = LOWER(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(unaccent_safe(name::text), '[^a-zA-Z0-9]+', '-', 'g'),
                  '(^-|-$)', '', 'g'
                )
              ) || '-' || SUBSTRING(id::text, 1, 8)
 WHERE slug IS NULL;

-- ---- Backfill cover_image from existing single image when present ----
UPDATE garages
   SET cover_image = image
 WHERE cover_image IS NULL AND image IS NOT NULL;

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_garages_slug         ON garages(slug);
CREATE INDEX IF NOT EXISTS idx_garages_status       ON garages(status);
CREATE INDEX IF NOT EXISTS idx_garages_city         ON garages(city);
CREATE INDEX IF NOT EXISTS idx_garages_specialties  ON garages USING GIN (specialties);
CREATE INDEX IF NOT EXISTS idx_garages_services     ON garages USING GIN (services);

-- ---- Constraint: status whitelist (drop & recreate to stay idempotent) ----
ALTER TABLE garages DROP CONSTRAINT IF EXISTS garages_status_check;
ALTER TABLE garages
  ADD CONSTRAINT garages_status_check
  CHECK (status IN ('active', 'pending', 'suspended', 'closed'));
