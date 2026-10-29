-- ============================================================
-- 021_tech_specs_norm_logo.sql
-- Adds the `norm_logo` column to tech_specs so the admin can
-- attach an emission norm badge (Euro 4 / Euro 5 / etc.) that
-- the public details page renders next to the model image.
-- ============================================================

ALTER TABLE tech_specs
  ADD COLUMN IF NOT EXISTS norm_logo TEXT;
