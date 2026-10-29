-- =====================================================
-- Migration 007 — full visitor tracking for monetization
-- Adds: page_views, listing_clicks, user_id linkage, geo
-- Idempotent: safe to re-run.
-- =====================================================

-- 1. Extend visitor_sessions with logged-in user link, country_code, UA, last activity.
ALTER TABLE visitor_sessions
  ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_code   VARCHAR(2),
  ADD COLUMN IF NOT EXISTS region         VARCHAR(120),
  ADD COLUMN IF NOT EXISTS user_agent     TEXT,
  ADD COLUMN IF NOT EXISTS language       VARCHAR(16),
  ADD COLUMN IF NOT EXISTS screen_size    VARCHAR(24),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sessions_user        ON visitor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_country     ON visitor_sessions(country_code);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON visitor_sessions(last_activity_at DESC);

-- 2. Extend visitor_profiles with logged-in user, country_code.
ALTER TABLE visitor_profiles
  ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS region       VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_profiles_user    ON visitor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON visitor_profiles(country_code);

-- 3. page_views — fine-grained per-page tracking.
CREATE TABLE IF NOT EXISTS page_views (
  id           BIGSERIAL PRIMARY KEY,
  session_id   UUID REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  fingerprint  VARCHAR(64),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  path         TEXT NOT NULL,
  view_name    VARCHAR(60),               -- 'home', 'search', 'listing-details', etc.
  referrer     TEXT,
  duration_ms  INTEGER DEFAULT 0,         -- updated on next page view / unload
  ip_address   INET,
  country_code VARCHAR(2),
  city         VARCHAR(100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_views_session  ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_finger   ON page_views(fingerprint);
CREATE INDEX IF NOT EXISTS idx_page_views_user     ON page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_view     ON page_views(view_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_created  ON page_views(created_at DESC);

-- 4. listing_clicks — every click on a listing card from a list/search page.
-- Distinct from listing_views (which is the detail page view).
CREATE TABLE IF NOT EXISTS listing_clicks (
  id          BIGSERIAL PRIMARY KEY,
  listing_id  UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  session_id  UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  fingerprint VARCHAR(64),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  source      VARCHAR(60),  -- 'search', 'home-popular', 'similar', 'favorites', etc.
  ip_address  INET,
  country_code VARCHAR(2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listing_clicks_listing ON listing_clicks(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_clicks_session ON listing_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_listing_clicks_finger  ON listing_clicks(fingerprint);
CREATE INDEX IF NOT EXISTS idx_listing_clicks_created ON listing_clicks(created_at DESC);

-- 5. listing_views: also link to fingerprint + country for richer admin analytics.
ALTER TABLE listing_views
  ADD COLUMN IF NOT EXISTS fingerprint  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
CREATE INDEX IF NOT EXISTS idx_listing_views_finger ON listing_views(fingerprint);
