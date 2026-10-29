-- =====================================================
-- Migration 023 — listing contact preference
--
-- Adds a per-listing toggle so the seller can choose whether visitors:
--   • see and call their phone number directly  (contact_method = 'phone')
--   • only request a callback / message         (contact_method = 'callback')
--
-- When set to 'callback', the backend hides seller_phone / seller_whatsapp
-- from anonymous and non-conversation viewers (admins + the owner still see
-- it for moderation / dashboard).
--
-- Idempotent: safe to re-run.
-- =====================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS contact_method VARCHAR(16) NOT NULL DEFAULT 'phone';

-- Constrain to known values. CHECK constraints can't be added IF NOT EXISTS,
-- so guard with a catalog lookup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_contact_method_chk'
  ) THEN
    ALTER TABLE listings
      ADD CONSTRAINT listings_contact_method_chk
      CHECK (contact_method IN ('phone','callback'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_contact_method ON listings(contact_method);
