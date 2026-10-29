-- Store the destination URL clicked for each ad so admin analytics can show
-- top landing pages per campaign. Idempotent for existing deployments.
ALTER TABLE ad_clicks
  ADD COLUMN IF NOT EXISTS landing_page TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_clicks_landing_page
  ON ad_clicks(campaign_id, landing_page);