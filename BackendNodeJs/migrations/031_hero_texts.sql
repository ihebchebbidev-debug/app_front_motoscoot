-- 031_hero_texts.sql
-- Seed an editable text block for the landing-page hero (title, subtitle,
-- and the badge suffix that follows the live listing count). Stored as a
-- second key in the existing `site_settings` JSONB store so admins can edit
-- the words without a redeploy.
INSERT INTO site_settings (key, value)
VALUES (
  'hero_texts',
  '{"title": null, "subtitle": null, "badge_suffix": null}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
