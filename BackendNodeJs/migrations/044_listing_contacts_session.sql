-- 044_listing_contacts_session.sql
-- Contact taps on a listing (Appeler, WhatsApp, Message) are counted once per
-- person and hour. A signed-in visitor is recognised by user_id; an anonymous
-- one by a random id kept for the browser tab (no cookie, nothing personal),
-- the same one the fiches techniques send (utils/ficheLeads.ts).
-- listingsExtraController.trackContact also adds the column at first use.
ALTER TABLE listing_contacts ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);
