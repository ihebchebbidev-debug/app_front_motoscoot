-- ============================================================================
-- Migration 020: prevent duplicate conversations for the same parties+listing.
--
-- The application code in conversationsController.create() does
--   SELECT existing → INSERT new
-- without a transaction. Two near-simultaneous "Contact seller" clicks
-- (mobile double-tap, retry on flaky network, two open tabs) can both pass
-- the SELECT and both INSERT, splitting the inbox into two parallel threads
-- with the same buyer/seller/listing.
--
-- This index makes that race impossible at the DB level — the second INSERT
-- now trips a unique violation, which the controller catches and converts
-- back into "use the existing thread".
--
-- We canonicalize the pair (buyer_id, seller_id) using LEAST/GREATEST so the
-- uniqueness holds regardless of which side opened the conversation first
-- (a re-open from the seller's side maps to the same key).
-- ============================================================================

-- Drop any duplicates that may already exist BEFORE creating the unique index,
-- otherwise CREATE UNIQUE INDEX would fail. We keep the OLDEST conversation
-- (lowest created_at) and reassign every message from the duplicates onto it,
-- then delete the duplicate rows. Safe to re-run.
DO $$
DECLARE
  dup RECORD;
  keeper_id UUID;
BEGIN
  FOR dup IN
    SELECT listing_id,
           LEAST(buyer_id, seller_id)    AS a,
           GREATEST(buyer_id, seller_id) AS b,
           array_agg(id ORDER BY created_at ASC) AS ids
      FROM conversations
     WHERE listing_id IS NOT NULL
     GROUP BY listing_id, LEAST(buyer_id, seller_id), GREATEST(buyer_id, seller_id)
    HAVING COUNT(*) > 1
  LOOP
    keeper_id := dup.ids[1];
    -- Re-point messages from every duplicate onto the keeper.
    UPDATE messages
       SET conversation_id = keeper_id
     WHERE conversation_id = ANY(dup.ids[2:array_length(dup.ids, 1)]);
    -- Drop the now-empty duplicate conversations.
    DELETE FROM conversations
     WHERE id = ANY(dup.ids[2:array_length(dup.ids, 1)]);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_listing_pair_uq
  ON conversations (
    listing_id,
    LEAST(buyer_id, seller_id),
    GREATEST(buyer_id, seller_id)
  )
  WHERE listing_id IS NOT NULL;