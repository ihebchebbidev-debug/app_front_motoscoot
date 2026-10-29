-- =====================================================
-- Migration 012 — audit fixes
--   * visitor_profiles: add user_id, region, country_code (used by analyticsController)
--   * visitor_sessions: ensure last_activity_at exists (the controller writes it
--     unconditionally; on fresh DBs that only ran 001 the column was missing,
--     causing /api/analytics/sessions to 500).
--   * garage_reviews: enforce one review per (user, garage) to stop spam.
-- Idempotent: safe to re-run.
-- =====================================================

-- visitor_sessions
ALTER TABLE visitor_sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS country_code     VARCHAR(2),
  ADD COLUMN IF NOT EXISTS region           VARCHAR(120),
  ADD COLUMN IF NOT EXISTS user_agent       TEXT,
  ADD COLUMN IF NOT EXISTS language         VARCHAR(16),
  ADD COLUMN IF NOT EXISTS screen_size      VARCHAR(24),
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON visitor_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_country     ON visitor_sessions(country_code);
CREATE INDEX IF NOT EXISTS idx_sessions_user        ON visitor_sessions(user_id);

-- visitor_profiles
ALTER TABLE visitor_profiles
  ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS region       VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_profiles_user    ON visitor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON visitor_profiles(country_code);

-- garage_reviews: one review per user per garage. Use NOT VALID so we don't
-- explode on legacy duplicates; new inserts are immediately blocked.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'garage_reviews_user_garage_unique'
  ) THEN
    -- Drop legacy duplicates first (keep the oldest review per user/garage).
    DELETE FROM garage_reviews gr
    USING garage_reviews gr2
    WHERE gr.user_id = gr2.user_id
      AND gr.garage_id = gr2.garage_id
      AND gr.created_at > gr2.created_at;

    ALTER TABLE garage_reviews
      ADD CONSTRAINT garage_reviews_user_garage_unique UNIQUE (user_id, garage_id);
  END IF;
END$$;

-- token_blacklist (defensive — used by /auth/logout & socket re-verify).
CREATE TABLE IF NOT EXISTS token_blacklist (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
