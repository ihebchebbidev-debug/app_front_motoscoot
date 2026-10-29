-- ============================================================
-- 033_seo_settings.sql
-- Seeds the `seo_settings` JSONB row used by:
--   • Public GET  /api/site-settings/seo        (safe fields only)
--   • Admin  GET  /api/admin/site-settings/seo  (full payload)
--   • Admin  PUT  /api/admin/site-settings/seo
--
-- Storage strategy: the existing `site_settings` table already supports
-- arbitrary JSONB blobs keyed by string. We simply ensure a default row
-- exists so the public endpoint never has to deal with NULL.
-- Idempotent.
-- ============================================================

INSERT INTO site_settings (key, value, updated_by)
VALUES (
  'seo_settings',
  jsonb_build_object(
    'default_title',          NULL,
    'title_template',         '%s | MotoScoot',
    'default_description',    NULL,
    'default_keywords',       NULL,
    'default_og_image',       NULL,
    'twitter_handle',         '@motoscoot_tn',
    'organization_name',      'MotoScoot',
    'organization_logo',      NULL,
    'organization_phone',     NULL,
    'organization_email',     NULL,
    'organization_address',   NULL,
    'ga4_measurement_id',     NULL,
    'ga4_api_secret',         NULL,
    'ga4_property_id',        NULL,
    'gsc_verification_code',  NULL,
    'gsc_site_url',           NULL,
    'google_service_account', NULL,
    'robots_extra',           NULL,
    'enable_analytics',       TRUE,
    'enable_organization_jsonld', TRUE
  ),
  NULL
)
ON CONFLICT (key) DO NOTHING;
