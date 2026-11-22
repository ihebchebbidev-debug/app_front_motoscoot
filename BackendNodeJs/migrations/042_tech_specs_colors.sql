-- ============================================================
-- 042_tech_specs_colors.sql
-- Colours of a fiche technique (owner, 2026-11-22): « Blanc », « Noir mat »…
-- Shown in the « Caractéristiques » table and in the « Questions
-- fréquentes » of the public page.
--
-- Idempotent. The API also adds the column on its own at the first admin
-- save that sends colours (src/utils/techSpecColors.js), so forgetting this
-- migration breaks nothing: reads simply find no colours.
-- ============================================================

ALTER TABLE tech_specs
  ADD COLUMN IF NOT EXISTS colors TEXT[] NOT NULL DEFAULT '{}';
