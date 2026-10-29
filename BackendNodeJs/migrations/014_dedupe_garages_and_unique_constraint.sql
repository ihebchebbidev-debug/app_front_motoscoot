-- =====================================================================
-- 014: Dedupe garages by (name, city) and enforce uniqueness
-- ---------------------------------------------------------------------
-- Each statement uses its own CTE because CTEs are scoped to a single
-- statement in PostgreSQL.
-- =====================================================================

BEGIN;

-- 2a. Reassign garage_reviews from duplicates → canonical row.
WITH ranked AS (
  SELECT id, name, city,
         ROW_NUMBER() OVER (PARTITION BY name, city ORDER BY created_at ASC, id ASC) AS rn
  FROM garages
),
canonical AS (
  SELECT name, city, id AS keep_id FROM ranked WHERE rn = 1
),
duplicates AS (
  SELECT r.id AS dup_id, c.keep_id
  FROM ranked r
  JOIN canonical c ON c.name = r.name AND c.city = r.city
  WHERE r.rn > 1
)
UPDATE garage_reviews gr
SET    garage_id = d.keep_id
FROM   duplicates d
WHERE  gr.garage_id = d.dup_id
  AND  NOT EXISTS (
        SELECT 1 FROM garage_reviews gr2
        WHERE gr2.garage_id = d.keep_id
          AND gr2.user_id   = gr.user_id
       );

-- 2b. Reassign garage_services from duplicates → canonical row.
WITH ranked AS (
  SELECT id, name, city,
         ROW_NUMBER() OVER (PARTITION BY name, city ORDER BY created_at ASC, id ASC) AS rn
  FROM garages
),
canonical AS (
  SELECT name, city, id AS keep_id FROM ranked WHERE rn = 1
),
duplicates AS (
  SELECT r.id AS dup_id, c.keep_id
  FROM ranked r
  JOIN canonical c ON c.name = r.name AND c.city = r.city
  WHERE r.rn > 1
)
UPDATE garage_services gs
SET    garage_id = d.keep_id
FROM   duplicates d
WHERE  gs.garage_id = d.dup_id
  AND  NOT EXISTS (
        SELECT 1 FROM garage_services gs2
        WHERE gs2.garage_id = d.keep_id
          AND gs2.name      = gs.name
       );

-- 3. Delete duplicate garages (any remaining child rows cascade).
WITH ranked AS (
  SELECT id, name, city,
         ROW_NUMBER() OVER (PARTITION BY name, city ORDER BY created_at ASC, id ASC) AS rn
  FROM garages
)
DELETE FROM garages g
USING ranked r
WHERE g.id = r.id AND r.rn > 1;

-- 4. Recompute reviews_count to match the post-dedupe truth.
UPDATE garages g
SET    reviews_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT garage_id, COUNT(*)::int AS cnt
  FROM   garage_reviews
  GROUP BY garage_id
) sub
WHERE g.id = sub.garage_id;

UPDATE garages
SET    reviews_count = 0
WHERE  reviews_count > 0
  AND  id NOT IN (SELECT DISTINCT garage_id FROM garage_reviews);

-- 5. Enforce uniqueness so this never happens again.
ALTER TABLE garages
  DROP CONSTRAINT IF EXISTS garages_name_city_unique;

ALTER TABLE garages
  ADD CONSTRAINT garages_name_city_unique UNIQUE (name, city);

COMMIT;
