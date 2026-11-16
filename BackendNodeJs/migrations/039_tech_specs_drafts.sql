-- ============================================================
-- 039_tech_specs_drafts.sql
-- Draft status for fiches techniques. A fiche with is_published = FALSE
-- is only visible in the back-office: public lists, search, detail page
-- (404), popular brands and the sitemap skip it. Fiches imported in bulk
-- from the admin ("Importer un lot") are created as drafts; the admin
-- checks them, adds photos, then publishes.
--
-- Default TRUE keeps every existing fiche visible. Idempotent. The API
-- also adds the column on its own at the first admin save
-- (src/utils/techSpecDrafts.js), so forgetting this migration breaks
-- nothing.
-- ============================================================

ALTER TABLE tech_specs
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
