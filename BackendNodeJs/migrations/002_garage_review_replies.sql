-- Adds owner-reply support on garage_reviews and an "is_verified" flag.
-- Idempotent: safe to re-run.

ALTER TABLE garage_reviews
  ADD COLUMN IF NOT EXISTS owner_reply    TEXT,
  ADD COLUMN IF NOT EXISTS owner_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_verified    BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_garage_reviews_garage ON garage_reviews(garage_id);
