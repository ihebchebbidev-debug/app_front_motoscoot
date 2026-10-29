-- 011_category_images.sql
-- ---------------------------------------------------------------------------
-- Adds admin-managed visuals + descriptions to the reference tables that
-- power the category pickers (deposit wizard, home category strip, search
-- filters). All columns are nullable so existing rows keep working without
-- a backfill.
-- ---------------------------------------------------------------------------

ALTER TABLE vehicle_categories
  ADD COLUMN IF NOT EXISTS image_url   text,
  ADD COLUMN IF NOT EXISTS icon_url    text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE accessory_types
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS icon_url  text;
