-- =====================================================
-- Migration 024 — Add JSONB `attributes` to listings
--
-- Stores category-specific attributes that don't deserve their own column,
-- in particular accessory metadata captured by the deposit wizard:
--   accessoryType, helmetType, visorType[], size, gender, shoeSize,
--   antiTheftType, intercomFeatures[]
--
-- JSONB keeps the schema flexible (we can add new accessory subtypes later
-- without a migration) and indexable (GIN) for future filter support.
-- Idempotent: safe to re-run.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'attributes'
  ) THEN
    ALTER TABLE listings
      ADD COLUMN attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_listings_attributes_gin
  ON listings USING gin (attributes);
