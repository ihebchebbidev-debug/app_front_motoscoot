-- 022_site_settings.sql
-- Generic key/value (JSONB) site settings table — used initially for the
-- landing-page hero images (desktop + mobile) that the admin can override
-- without a redeploy. Designed to host any future "site-wide" toggle
-- (announcement banner, theme color, etc.) by adding new keys.

CREATE TABLE IF NOT EXISTS site_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Auto-bump updated_at on every UPDATE (small trigger, scoped to this table).
CREATE OR REPLACE FUNCTION site_settings_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_settings_set_updated_at ON site_settings;
CREATE TRIGGER site_settings_set_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION site_settings_touch_updated_at();

-- Seed the hero defaults so a fresh DB matches what the frontend currently
-- ships hard-coded. Admin overrides (with .url values) take precedence.
INSERT INTO site_settings (key, value)
VALUES (
  'hero_images',
  '{"desktop_url": null, "mobile_url": null, "background_color": null}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

UPDATE site_settings
SET value = value || '{"background_color": null}'::jsonb
WHERE key = 'hero_images' AND NOT (value ? 'background_color');
