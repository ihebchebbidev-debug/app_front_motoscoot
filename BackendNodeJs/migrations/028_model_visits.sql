-- ============================================================
-- 028_model_visits.sql
-- Tracks how many distinct visitor clicks each (brand, model)
-- of the catalogue (tech_specs) receives. Used by the admin
-- BrandTrendsPanel "Modèles de <marque>" drill-down so the
-- breakdown reflects real visitor demand instead of catalogue size.
-- ============================================================

CREATE TABLE IF NOT EXISTS model_visits (
  brand   VARCHAR(100) NOT NULL,
  model   VARCHAR(150) NOT NULL,
  visits  INTEGER      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brand, model)
);

CREATE INDEX IF NOT EXISTS idx_model_visits_brand_visits
  ON model_visits (brand, visits DESC);
