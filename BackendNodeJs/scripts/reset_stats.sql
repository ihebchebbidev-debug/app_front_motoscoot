-- ============================================================
-- reset_stats.sql — Wipe every analytics/tracking table and
-- reset all per-row counters so the app starts from zero on
-- launch day. Does NOT touch product data:
--   listings, users, garages, brands, articles, tips, faq,
--   site_settings, importers, tech_specs, conversations, messages,
--   notifications, reports, newsletter, site_reviews.
--
-- USAGE (from BackendNodeJs/):
--   psql "$DATABASE_URL" -f scripts/reset_stats.sql
--
-- Safe to run multiple times. Wrapped in a transaction so a
-- failure on any line rolls back the whole reset.
-- ============================================================

BEGIN;

-- ---- 1. Visitor / session / page tracking ---------------------------------
TRUNCATE TABLE
  page_views,
  listing_clicks,
  listing_views,
  listing_events,
  visitor_sessions,
  visitor_profiles
RESTART IDENTITY CASCADE;

-- ---- 2. Listing engagement (kept rows, but clean their analytics tables) --
TRUNCATE TABLE
  listing_contacts,
  listing_shares
RESTART IDENTITY CASCADE;

-- Favorites are user-generated content (they survive). If you also want a
-- 100% clean slate, uncomment:
-- TRUNCATE TABLE favorites RESTART IDENTITY CASCADE;

-- ---- 3. Brand & model demand tracking -------------------------------------
TRUNCATE TABLE
  brand_visits,
  brand_visit_events,
  brand_visit_daily,
  model_visits
RESTART IDENTITY CASCADE;

-- ---- 4. Ad tracking (impressions / clicks if present) ---------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_impressions') THEN
    EXECUTE 'TRUNCATE TABLE ad_impressions RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_clicks') THEN
    EXECUTE 'TRUNCATE TABLE ad_clicks RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- ---- 5. Reset cached counters on listings ---------------------------------
UPDATE listings SET
  views_count     = 0,
  favorites_count = 0,
  contacts_count  = 0,
  shares_count    = 0;

-- ---- 6. Reset cached counters on users (if columns exist) -----------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'profile_views'
  ) THEN
    EXECUTE 'UPDATE users SET profile_views = 0';
  END IF;
END $$;

-- ---- 7. Quick sanity check -------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM visitor_sessions)  AS sessions,
  (SELECT COUNT(*) FROM page_views)        AS page_views,
  (SELECT COUNT(*) FROM listing_views)     AS listing_views,
  (SELECT COUNT(*) FROM listing_clicks)    AS listing_clicks,
  (SELECT COUNT(*) FROM listing_contacts)  AS listing_contacts,
  (SELECT COUNT(*) FROM listing_shares)    AS listing_shares,
  (SELECT COUNT(*) FROM brand_visits)      AS brand_visits,
  (SELECT COUNT(*) FROM model_visits)      AS model_visits,
  (SELECT COALESCE(SUM(views_count),0)     FROM listings) AS sum_views_count,
  (SELECT COALESCE(SUM(contacts_count),0)  FROM listings) AS sum_contacts_count;

COMMIT;

-- All counters should now read 0. Tracking starts fresh from this moment.
