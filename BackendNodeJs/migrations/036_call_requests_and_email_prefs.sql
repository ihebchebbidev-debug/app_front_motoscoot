-- ============================================================
-- 036_call_requests_and_email_prefs.sql
-- Adds infra for the missing transactional emails:
--   1) call_requests       — store "Demander un rappel" submissions
--   2) email_preferences   — per-user opt-out for marketing emails
--                            (similar listings + newsletter + promos)
--   3) similar_listings_digests — dedupe key so a user gets at most
--                                 one digest per day even if cron runs twice
-- ============================================================

CREATE TABLE IF NOT EXISTS call_requests (
  id           BIGSERIAL PRIMARY KEY,
  listing_id   UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  requester_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requester_name    VARCHAR(120),
  requester_phone   VARCHAR(40)  NOT NULL,
  message           TEXT,
  ip_address        VARCHAR(64),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_requests_listing ON call_requests (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_requests_created ON call_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS email_preferences (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  similar_listings   BOOLEAN NOT NULL DEFAULT TRUE,
  newsletter         BOOLEAN NOT NULL DEFAULT TRUE,
  promotions         BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS similar_listings_digests (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_on    DATE NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, sent_on)
);
