-- 034_app_background.sql
-- Admin-controlled background colour for the app shell (the "gray" surface
-- behind cards on listing/search/dashboard pages — i.e. the `bg-muted`
-- token). Stored under the `app_background` site_settings key so it can be
-- updated live without a redeploy.
INSERT INTO site_settings (key, value)
VALUES ('app_background', '{"color": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;