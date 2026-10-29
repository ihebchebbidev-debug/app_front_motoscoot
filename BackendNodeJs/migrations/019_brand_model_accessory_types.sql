-- =====================================================
-- Migration 019 — Intelligent reference: brand / model / equipment
--                 ↔ accessory_type links
--
-- Migration 018 made it possible for admins to curate which VEHICLE
-- categories (Moto, Scooter, Quad…) each brand belongs to. That fixed
-- the buyer-side dropdown for Moto / Scooter / Quad — but for the
-- "Accessoires" category the brand list was still showing every brand
-- in the database (Yamaha, Honda, Ducati…) instead of only the brands
-- that actually sell the chosen accessory type (Casque → Shoei, AGV…).
--
-- This migration introduces three explicit join surfaces:
--   1. brand_accessory_types (brand_id, accessory_type)
--      — "Shoei sells Casque", "Bering sells Veste & Pantalons", …
--   2. model_accessory_types (model_id, accessory_type)
--      — once a brand+accessory type is chosen, the model dropdown can
--        narrow further (e.g. AGV K6 = Casque).
--   3. equipment.accessory_type (TEXT, nullable)
--      — equipment options can be scoped to an accessory type so the
--        equipment step in the wizard only shows relevant choices when
--        the user is depositing an accessory.
--
-- Idempotent: safe to re-run.
-- =====================================================

-- 1. brand ↔ accessory_type ----------------------------------------------------
CREATE TABLE IF NOT EXISTS brand_accessory_types (
  brand_id        INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  accessory_type  TEXT    NOT NULL,
  PRIMARY KEY (brand_id, accessory_type)
);

CREATE INDEX IF NOT EXISTS idx_brand_accessory_types_type
  ON brand_accessory_types (accessory_type);

-- 2. model ↔ accessory_type ----------------------------------------------------
CREATE TABLE IF NOT EXISTS model_accessory_types (
  model_id        INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  accessory_type  TEXT    NOT NULL,
  PRIMARY KEY (model_id, accessory_type)
);

CREATE INDEX IF NOT EXISTS idx_model_accessory_types_type
  ON model_accessory_types (accessory_type);

-- 3. equipment.accessory_type --------------------------------------------------
-- Existing equipment rows have a `category` column already
-- (securite/confort/praticite/tech) used to group bike-equipment options.
-- We keep that and add a *separate* nullable column so an equipment row can
-- additionally be flagged as belonging to a given accessory type
-- (e.g. "Pinlock" → Casque, "Coque dorsale" → Veste, …).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'equipment' AND column_name = 'accessory_type'
  ) THEN
    ALTER TABLE equipment ADD COLUMN accessory_type TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equipment_accessory_type
  ON equipment (accessory_type);

-- =====================================================
-- Seed — well-known accessory brands.
-- Inserts brand rows ON CONFLICT DO NOTHING (brands.name is UNIQUE),
-- then links each one to the relevant accessory type(s).
--
-- Helmets (Casque): Shoei, AGV, Shark, HJC, Arai, Nolan, Schuberth, Scorpion, LS2, Bell, MT Helmets
-- Gloves (Gant) + Jackets (Veste) + Pants (Pantalons): Alpinestars, Dainese, Bering, Furygan, Held, Ixon, Five, Richa, Rev'It, Spidi
-- Locks (Antivol): Abus, Kryptonite, Auvray
-- Intercom: Cardo, Sena, Interphone
-- Boots (Chaussures): TCX, Sidi, Forma, Stylmartin (also covered by Alpinestars/Dainese)
-- =====================================================

WITH accessory_brands(name, types) AS (
  VALUES
    ('Shoei',        ARRAY['Casque']),
    ('AGV',          ARRAY['Casque']),
    ('Shark',        ARRAY['Casque']),
    ('HJC',          ARRAY['Casque']),
    ('Arai',         ARRAY['Casque']),
    ('Nolan',        ARRAY['Casque']),
    ('Schuberth',    ARRAY['Casque']),
    ('Scorpion',     ARRAY['Casque']),
    ('LS2',          ARRAY['Casque']),
    ('Bell',         ARRAY['Casque']),
    ('MT Helmets',   ARRAY['Casque']),
    ('Alpinestars',  ARRAY['Gant','Veste','Pantalons','Chaussures']),
    ('Dainese',      ARRAY['Gant','Veste','Pantalons','Chaussures']),
    ('Bering',       ARRAY['Gant','Veste','Pantalons']),
    ('Furygan',      ARRAY['Gant','Veste','Pantalons']),
    ('Held',         ARRAY['Gant','Veste','Pantalons']),
    ('Ixon',         ARRAY['Gant','Veste','Pantalons']),
    ('Five',         ARRAY['Gant']),
    ('Richa',        ARRAY['Gant','Veste','Pantalons']),
    ('Rev''It',      ARRAY['Gant','Veste','Pantalons']),
    ('Spidi',        ARRAY['Gant','Veste','Pantalons']),
    ('TCX',          ARRAY['Chaussures']),
    ('Sidi',         ARRAY['Chaussures']),
    ('Forma',        ARRAY['Chaussures']),
    ('Stylmartin',   ARRAY['Chaussures']),
    ('Abus',         ARRAY['Antivol']),
    ('Kryptonite',   ARRAY['Antivol']),
    ('Auvray',       ARRAY['Antivol']),
    ('Cardo',        ARRAY['Intercom']),
    ('Sena',         ARRAY['Intercom']),
    ('Interphone',   ARRAY['Intercom'])
)
INSERT INTO brands (name)
SELECT name FROM accessory_brands
ON CONFLICT (name) DO NOTHING;

-- Link each seeded brand to its accessory types.
INSERT INTO brand_accessory_types (brand_id, accessory_type)
SELECT b.id, t.accessory_type
  FROM (
    VALUES
      ('Shoei','Casque'),('AGV','Casque'),('Shark','Casque'),('HJC','Casque'),
      ('Arai','Casque'),('Nolan','Casque'),('Schuberth','Casque'),('Scorpion','Casque'),
      ('LS2','Casque'),('Bell','Casque'),('MT Helmets','Casque'),
      ('Alpinestars','Gant'),('Alpinestars','Veste'),('Alpinestars','Pantalons'),('Alpinestars','Chaussures'),
      ('Dainese','Gant'),('Dainese','Veste'),('Dainese','Pantalons'),('Dainese','Chaussures'),
      ('Bering','Gant'),('Bering','Veste'),('Bering','Pantalons'),
      ('Furygan','Gant'),('Furygan','Veste'),('Furygan','Pantalons'),
      ('Held','Gant'),('Held','Veste'),('Held','Pantalons'),
      ('Ixon','Gant'),('Ixon','Veste'),('Ixon','Pantalons'),
      ('Five','Gant'),
      ('Richa','Gant'),('Richa','Veste'),('Richa','Pantalons'),
      ('Rev''It','Gant'),('Rev''It','Veste'),('Rev''It','Pantalons'),
      ('Spidi','Gant'),('Spidi','Veste'),('Spidi','Pantalons'),
      ('TCX','Chaussures'),('Sidi','Chaussures'),('Forma','Chaussures'),('Stylmartin','Chaussures'),
      ('Abus','Antivol'),('Kryptonite','Antivol'),('Auvray','Antivol'),
      ('Cardo','Intercom'),('Sena','Intercom'),('Interphone','Intercom')
  ) AS t(brand_name, accessory_type)
  JOIN brands b ON b.name = t.brand_name
ON CONFLICT DO NOTHING;
