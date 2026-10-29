-- ============================================================
-- 026_importers.sql
-- Adds an "importateurs" catalog so the admin can register the
-- official importers/distributors of motorcycle brands in Tunisia
-- and assign one to each fiche technique. The public details
-- page renders the assigned importer's contact card dynamically
-- (replacing the previously hardcoded dealer block).
-- ============================================================

CREATE TABLE IF NOT EXISTS importers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  logo_url    TEXT,
  address     TEXT,
  city        TEXT,
  phone       TEXT,
  whatsapp    TEXT,
  email       TEXT,
  website     TEXT,
  description TEXT,
  rating      NUMERIC(3,2),         -- e.g. 4.20
  reviews_count INTEGER DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS importers_name_unique
  ON importers (LOWER(name));

-- Link tech_specs → importers (nullable: a fiche may not yet have
-- an assigned importer, in which case the public card is hidden).
ALTER TABLE tech_specs
  ADD COLUMN IF NOT EXISTS importer_id UUID
    REFERENCES importers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tech_specs_importer_idx
  ON tech_specs (importer_id);