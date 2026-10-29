-- =====================================================
-- Migration 009 — Sync reference tables to match frontend form logic
-- Idempotent: safe to re-run.
-- =====================================================

-- ---- ACCESSORY TYPES: rename plural → singular to match Zod schema ----
UPDATE accessory_types SET name = 'Casque'     WHERE name = 'Casques';
UPDATE accessory_types SET name = 'Gant'       WHERE name = 'Gants';
UPDATE accessory_types SET name = 'Veste'      WHERE name = 'Vestes';
UPDATE accessory_types SET name = 'Chaussures' WHERE name = 'Bottes';
UPDATE accessory_types SET name = 'Antivol'    WHERE name = 'Antivols';
DELETE FROM accessory_types
  WHERE name IN ('Protections', 'Électronique', 'Entretien', 'Pièces détachées');

INSERT INTO accessory_types (name, position) VALUES
  ('Intercom', 8),
  ('GPS',      9)
ON CONFLICT (name) DO NOTHING;

UPDATE accessory_types SET position = CASE name
  WHEN 'Casque'      THEN 1
  WHEN 'Gant'        THEN 2
  WHEN 'Veste'       THEN 3
  WHEN 'Pantalons'   THEN 4
  WHEN 'Chaussures'  THEN 5
  WHEN 'Antivol'     THEN 6
  WHEN 'Bagagerie'   THEN 7
  WHEN 'Intercom'    THEN 8
  WHEN 'GPS'         THEN 9
  ELSE 99
END;

-- ---- EQUIPMENT: replace with frontend UI groups (4 categories) ----
DELETE FROM equipment;
INSERT INTO equipment (name, category) VALUES
  ('ABS',                   'securite'),
  ('Antipatinage',          'securite'),
  ('Modes de conduite',     'securite'),
  ('Éclairage Full LED',    'securite'),
  ('Régulateur de vitesse', 'confort'),
  ('Poignées chauffantes',  'confort'),
  ('Bulle / pare-brise',    'confort'),
  ('Selle confort',         'confort'),
  ('Top case',              'praticite'),
  ('Valises latérales',     'praticite'),
  ('Béquille centrale',     'praticite'),
  ('Prise USB',             'tech'),
  ('Démarrage sans clé',    'tech'),
  ('Quickshifter',          'tech'),
  ('Alarme',                'tech')
ON CONFLICT (name) DO NOTHING;
