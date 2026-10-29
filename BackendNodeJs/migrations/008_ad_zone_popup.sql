-- =====================================================
-- 008_ad_zone_popup.sql
-- Add 'popup' to the ad_zone enum so the frontend PopupAd component
-- can fetch /api/ads/active?zone=popup without triggering a Postgres
-- "invalid input value for enum ad_zone" error (which surfaces as 500).
-- Idempotent: ALTER TYPE ... ADD VALUE IF NOT EXISTS is safe to run twice.
-- =====================================================

DO $$
BEGIN
  ALTER TYPE ad_zone ADD VALUE IF NOT EXISTS 'popup';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
