-- ============================================================
-- 032_tech_specs_available_in_tunisia.sql
-- Adds a boolean flag indicating whether the model is officially
-- available (sold neuf) in Tunisia. Public tech-specs endpoints
-- (brands list, models list, popular, latest, search, categories)
-- filter on this flag so end users only see brands/models they can
-- actually buy locally. Admin endpoints keep full visibility.
--
-- Default TRUE preserves visibility of existing rows; admins can
-- untick the toggle on a per-fiche basis from the admin panel.
-- Idempotent.
-- ============================================================

ALTER TABLE tech_specs
  ADD COLUMN IF NOT EXISTS available_in_tunisia BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_tech_specs_available_in_tunisia
  ON tech_specs (available_in_tunisia)
  WHERE available_in_tunisia = TRUE;
