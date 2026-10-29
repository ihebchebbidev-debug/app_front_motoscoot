-- =====================================================
-- 035_ad_zone_fullscreen.sql
-- Add 'fullscreen' to the ad_zone enum so admins can create large
-- near-fullscreen overlay campaigns served by <FullscreenAd /> mounted
-- globally in App.tsx (mobile + desktop variants of the same overlay).
-- Idempotent.
-- =====================================================

DO $$
BEGIN
  ALTER TYPE ad_zone ADD VALUE IF NOT EXISTS 'fullscreen';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
