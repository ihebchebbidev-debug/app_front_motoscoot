-- Corrections from the customer document dated 2026-10-20.

-- 1) Short, immutable listing numbers (/annonce/voge-900-blacknight-2024-1).
--    Numbers are assigned in creation order and never reused.
CREATE SEQUENCE IF NOT EXISTS listings_number_seq;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_number BIGINT;
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n
    FROM listings WHERE listing_number IS NULL
)
UPDATE listings l
   SET listing_number = o.n + COALESCE((SELECT MAX(listing_number) FROM listings), 0)
  FROM ordered o WHERE o.id = l.id;
SELECT setval('listings_number_seq', GREATEST(COALESCE((SELECT MAX(listing_number) FROM listings), 0), 1),
              (SELECT MAX(listing_number) IS NOT NULL FROM listings));
ALTER TABLE listings ALTER COLUMN listing_number SET DEFAULT nextval('listings_number_seq');
ALTER TABLE listings ALTER COLUMN listing_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS listings_listing_number_key ON listings(listing_number);

-- 2) Stable technical-sheet slugs (/fiche-technique/sym-jet-14-evo).
--    Collisions get the year, then a counter appended.
ALTER TABLE tech_specs ADD COLUMN IF NOT EXISTS slug VARCHAR(200);
CREATE OR REPLACE FUNCTION ms_slugify(t TEXT) RETURNS TEXT AS $$
  SELECT trim(both '-' FROM regexp_replace(
           regexp_replace(lower(translate(COALESCE(t,''),
             'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
             'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY')),
             '[^a-z0-9]+', '-', 'g'),
           '-+', '-', 'g'))
$$ LANGUAGE SQL IMMUTABLE;

DO $$
DECLARE r RECORD; base TEXT; cand TEXT; n INT;
BEGIN
  FOR r IN SELECT id, brand, model, year FROM tech_specs WHERE slug IS NULL ORDER BY created_at NULLS LAST, id LOOP
    base := ms_slugify(r.brand || ' ' || r.model);
    IF base = '' THEN base := 'fiche'; END IF;
    cand := base;
    IF EXISTS (SELECT 1 FROM tech_specs WHERE slug = cand) THEN
      cand := base || '-' || COALESCE(r.year::text, '');
      n := 2;
      WHILE EXISTS (SELECT 1 FROM tech_specs WHERE slug = cand) LOOP
        cand := base || '-' || COALESCE(r.year::text, '') || '-' || n; n := n + 1;
      END LOOP;
    END IF;
    UPDATE tech_specs SET slug = cand WHERE id = r.id;
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS tech_specs_slug_key ON tech_specs(slug);

-- 3) Warranty & maintenance section, editable from the backoffice.
ALTER TABLE tech_specs ADD COLUMN IF NOT EXISTS maintenance JSONB DEFAULT '{}'::jsonb;

-- 4) Admin-authored testimonials are flagged so they're distinguishable.
ALTER TABLE site_reviews ADD COLUMN IF NOT EXISTS is_admin_entry BOOLEAN DEFAULT FALSE;
