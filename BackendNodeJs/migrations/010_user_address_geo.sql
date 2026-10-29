-- =============================================================================
-- Migration 010 — Persist a free-text address + map coordinates on users
-- =============================================================================
-- The dashboard Settings tab now lets a seller pin their location on a map
-- (Leaflet) and save the resulting lat/lng + a free-text street address.
-- These are then used:
--   * by the listing details page to show where the seller is roughly located
--   * to pre-fill the deposit form so a new ad inherits the seller location
--
-- We add the columns conditionally so re-running the migration is safe, and we
-- keep them nullable since older accounts won't have any address yet.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS address     TEXT,
  ADD COLUMN IF NOT EXISTS latitude    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude   DOUBLE PRECISION;

-- Loose validation: latitude must be -90..90, longitude -180..180 when set.
-- We use NOT VALID + VALIDATE to avoid blocking the migration if any legacy
-- row happens to fail (it shouldn't, since both columns are new).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_latitude_range'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_latitude_range
      CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)) NOT VALID;
    ALTER TABLE users VALIDATE CONSTRAINT users_latitude_range;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_longitude_range'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_longitude_range
      CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)) NOT VALID;
    ALTER TABLE users VALIDATE CONSTRAINT users_longitude_range;
  END IF;
END $$;
