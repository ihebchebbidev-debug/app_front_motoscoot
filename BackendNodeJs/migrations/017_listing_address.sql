-- Migration 017 — Add a free-text street address on listings
--
-- Listings already have `latitude` / `longitude` (migration 001) for the
-- map-based filters and the seller card mini-map, but they had no place to
-- store the street address the seller picks during the deposit wizard.
--
-- This adds an optional `address` column so the new "Localisation" step in
-- the deposit flow can persist what the user typed / what the reverse
-- geocoder returned next to the coordinates. Kept nullable so older listings
-- without an address keep working unchanged.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS address TEXT;
