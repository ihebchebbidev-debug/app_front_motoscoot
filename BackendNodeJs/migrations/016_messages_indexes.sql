-- 016 — Index hot lookups for messaging hot paths
--
-- conversationsController.getAll() does a LATERAL subquery to fetch the latest
-- message per conversation:
--
--   LEFT JOIN LATERAL (
--     SELECT content, type, sender_id FROM messages
--     WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
--   ) m ON true
--
-- Without a (conversation_id, created_at DESC) composite index, Postgres scans
-- every message in the conversation to find the newest one — O(n) per row of
-- the outer query. The index turns the per-row work into an index-only
-- top-1 lookup, O(log n).
--
-- We also add (conversation_id, is_read, sender_id) to make the unread-count
-- recompute in markAsRead() and getUnreadCount() index-only.

BEGIN;

CREATE INDEX IF NOT EXISTS messages_conv_created_idx
  ON messages (conversation_id, created_at DESC);

-- Helps:
--   • markAsRead's recompute: WHERE conversation_id=$1 AND sender_id != $2 AND is_read = false
--   • the equivalent unread aggregation in getUnreadCount/getAll
-- Partial index on the unread side keeps it tiny — read messages dwarf unread
-- ones over time and don't need to be in this index at all.
CREATE INDEX IF NOT EXISTS messages_conv_unread_idx
  ON messages (conversation_id, sender_id)
  WHERE is_read = false;

COMMIT;
