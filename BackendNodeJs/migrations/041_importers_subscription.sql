-- ============================================================
-- 041_importers_subscription.sql
-- Importer subscription end date (« abonnement ») — the Appel, WhatsApp
-- and Devis buttons of a fiche show while it is >= today.
-- To run with the database owner's account: the site's own account may
-- not own the importers table (ALTER TABLE needs ownership).
-- ============================================================
ALTER TABLE importers ADD COLUMN IF NOT EXISTS subscription_until DATE;
