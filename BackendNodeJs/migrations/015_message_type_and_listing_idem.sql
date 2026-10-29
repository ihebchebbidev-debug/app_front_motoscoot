-- 015 — Message type whitelist + listing create idempotency
--
-- Two unrelated hardening changes bundled into one migration so deploys stay simple:
--
-- 1. messages.type CHECK constraint
--    Server already validates against an allow-list in sendMessage(), but the DB
--    must be the source of truth so any future endpoint (admin tools, scripts,
--    seeds) can't insert a bogus type that the chat UI then can't render.
--
-- 2. Listing-create idempotency
--    Mobile clients on flaky networks frequently retry POST /listings before the
--    first response lands, producing duplicate ads. A unique partial index over
--    (user_id, lower(title), minute-bucket) blocks the duplicate at the DB level
--    while still allowing the same user to legitimately re-list the same title
--    later. Controller catches the 23505 and returns the original row.

BEGIN;

-- ─── 1) messages.type whitelist ──────────────────────────────────────────────
-- Backfill any stray NULL or unknown values to 'text' so the constraint can be
-- added without rejecting historical rows.
UPDATE messages
   SET type = 'text'
 WHERE type IS NULL
    OR type NOT IN ('text', 'image', 'offer', 'system');

ALTER TABLE messages
  ALTER COLUMN type SET DEFAULT 'text',
  ALTER COLUMN type SET NOT NULL;

-- Drop any prior version of the constraint so re-running the migration is idempotent.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text', 'image', 'offer', 'system'));

-- ─── 2) Listing create idempotency ───────────────────────────────────────────
-- Partial unique index: same user posting the same title within the same minute
-- bucket can only succeed once. We deliberately scope to a 1-minute window so
-- deduping doesn't bite legitimate re-listings.
--
-- IMMUTABLE expression required for an index. date_trunc(text, timestamptz)
-- is only STABLE (depends on TimeZone GUC), and casting timestamptz::timestamp
-- is also STABLE for the same reason. The two-arg form
-- date_trunc(text, timestamptz, text) with an explicit zone IS IMMUTABLE,
-- so we anchor to UTC to get a deterministic minute bucket.
CREATE UNIQUE INDEX IF NOT EXISTS listings_user_title_minute_uq
  ON listings (
    user_id,
    lower(title),
    date_trunc('minute', created_at, 'UTC')
  );

COMMIT;
