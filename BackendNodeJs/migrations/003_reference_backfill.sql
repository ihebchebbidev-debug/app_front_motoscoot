-- =====================================================
-- Migration 003 — Full reference-data backfill + new
-- reference tables (vehicle_categories, accessory_types,
-- garage_specialties, garage_services).
-- Idempotent: safe to re-run.
-- =====================================================

-- ---------- BRANDS: full Tunisian-market backfill + logos ----------
INSERT INTO brands (name, logo_url) VALUES
  ('Peugeot Motorcycles', 'https://www.magma-studio.tn/portfolio2/moto/Logo/brand%20logo/peugeot.svg'),
  ('Piaggio',             'https://www.magma-studio.tn/portfolio2/moto/Logo/brand%20logo/piagio.svg'),
  ('Voge',                'https://www.magma-studio.tn/portfolio2/moto/Logo/brand%20logo/voge.svg'),
  ('Aprilia',             NULL),
  ('Ki-Motors',           NULL),
  ('SYM',                 'https://www.magma-studio.tn/portfolio2/moto/Logo/brand%20logo/sym.svg'),
  ('SLC',                 NULL),
  ('Dayun Motorcycle',    NULL),
  ('Uniscoot',            NULL),
  ('Kymco',               'https://www.magma-studio.tn/portfolio2/moto/Logo/brand%20logo/kymco.svg'),
  ('QJMotor',             NULL),
  ('SMT',                 NULL),
  ('Phantom',             NULL),
  ('First Motos',         NULL),
  ('Suzuki',              'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Suzuki_logo_2.svg/2560px-Suzuki_logo_2.svg.png'),
  ('Senke',               NULL),
  ('BBM',                 NULL),
  ('Zimota',              NULL),
  ('Zontes',              'https://www.magma-studio.tn/portfolio2/moto/Logo/brand%20logo/Zontes.webp'),
  ('CForce',              NULL),
  ('LM',                  NULL),
  ('Novago',              NULL),
  ('Lifan',               NULL),
  ('Sanya',               NULL),
  ('GSM Gouiaa',          NULL),
  ('CFMoto',              'https://www.magma-studio.tn/portfolio2/moto/Logo/brand%20logo/cfmoto.svg'),
  ('FTM',                 NULL),
  ('Haojin',              NULL),
  ('AA Tunisie',          NULL),
  ('E-Rider',             NULL),
  ('Yadea',               NULL),
  ('WattGo',              NULL),
  ('Letbe',               NULL),
  ('Ecoride',             NULL),
  ('Vigo',                NULL),
  ('Gold Motors',         NULL),
  ('XTF',                 NULL),
  ('Nlvneng',             NULL),
  ('Motolux',             NULL),
  ('Mistral',             NULL),
  ('Luolf Moto',          NULL),
  ('City Bike',           NULL),
  ('Rap Sev',             NULL),
  ('Keren',               NULL),
  ('Teyin',               NULL),
  ('PISTA HR+',           NULL),
  ('Ghost',               NULL),
  ('Blaster',             NULL),
  ('Autre',               NULL)
ON CONFLICT (name) DO UPDATE SET logo_url = COALESCE(EXCLUDED.logo_url, brands.logo_url);

-- ---------- MODELS per brand ----------
INSERT INTO models (brand_id, name, category)
SELECT b.id, m.name, m.category
FROM brands b
JOIN (VALUES
  ('SYM', 'Maxsym TL 508', 'Scooter'),
  ('SYM', 'Cruisym Alpha 300', 'Scooter'),
  ('SYM', 'ADX 125', 'Scooter'),
  ('SYM', 'NHX 125', 'Scooter'),
  ('SYM', 'JET X 125', 'Scooter'),
  ('SYM', 'Husky ADX 300CC', 'Scooter'),
  ('SYM', 'Orbit II', 'Scooter'),
  ('SYM', 'FIDDLE 4', 'Scooter'),
  ('SYM', 'FIDDLE II EFI', 'Scooter'),
  ('SYM', 'JET 4 RX 125', 'Scooter'),
  ('SYM', 'SYMPHONY ST 200', 'Scooter'),
  ('SYM', 'JET 14 125', 'Scooter'),
  ('SYM', 'SYMPHONY ST 125', 'Scooter'),
  ('SYM', 'SYMPHONY S 125', 'Scooter'),
  ('SYM', 'SYMPHONY SR 125', 'Scooter'),
  ('Piaggio', 'Vespa GTS 300', 'Scooter'),
  ('Piaggio', 'Vespa Primavera', 'Scooter'),
  ('Piaggio', 'Beverly 400', 'Scooter'),
  ('Piaggio', 'Liberty 125', 'Scooter'),
  ('Peugeot Motorcycles', 'XP400', 'Scooter'),
  ('Peugeot Motorcycles', 'Django 125', 'Scooter'),
  ('Peugeot Motorcycles', 'Kisbee 50', 'Scooter'),
  ('Peugeot Motorcycles', 'Tweet 125', 'Scooter'),
  ('Zontes', '350E', 'Moto'),
  ('Zontes', '350D', 'Moto'),
  ('Zontes', 'ZT 310-T', 'Moto'),
  ('Zontes', '368G', 'Moto'),
  ('Voge', 'SR ADV', 'Moto'),
  ('Voge', 'SR16', 'Moto'),
  ('Voge', 'SR4 Max', 'Scooter'),
  ('Voge', 'DS800X Rally', 'Moto'),
  ('Voge', 'DS 525X', 'Moto'),
  ('Voge', 'SR3', 'Moto'),
  ('CFMoto', '450SR', 'Moto'),
  ('CFMoto', 'NK 800', 'Moto'),
  ('CFMoto', 'MT 450', 'Moto'),
  ('CFMoto', 'CL-X 700', 'Moto'),
  ('Suzuki', 'Burgman 400', 'Scooter'),
  ('Suzuki', 'GSX-R 600', 'Moto'),
  ('Suzuki', 'V-Strom 650', 'Moto'),
  ('Aprilia', 'SR GT 200', 'Scooter'),
  ('Aprilia', 'Tuono 660', 'Moto'),
  ('Kymco', 'AK 550', 'Scooter'),
  ('Kymco', 'Xciting 400', 'Scooter'),
  ('Kymco', 'Agility 125', 'Scooter')
) AS m(brand_name, name, category) ON b.name = m.brand_name
ON CONFLICT (brand_id, name) DO NOTHING;

-- ---------- CITIES: full 24-governorate list ----------
INSERT INTO cities (name, governorate) VALUES
  ('Tunis','Tunis'),('La Marsa','Tunis'),('Le Bardo','Tunis'),('Carthage','Tunis'),('La Goulette','Tunis'),
  ('Ariana','Ariana'),('Raoued','Ariana'),('Sidi Thabet','Ariana'),
  ('Ben Arous','Ben Arous'),('Hammam Lif','Ben Arous'),('Radès','Ben Arous'),('El Mourouj','Ben Arous'),
  ('Manouba','Manouba'),('Den Den','Manouba'),('Tebourba','Manouba'),
  ('Sousse','Sousse'),('Hammam Sousse','Sousse'),('Kalâa Kebira','Sousse'),('Msaken','Sousse'),
  ('Sfax','Sfax'),('Sakiet Ezzit','Sfax'),('Sakiet Eddaier','Sfax'),
  ('Nabeul','Nabeul'),('Hammamet','Nabeul'),('Kelibia','Nabeul'),('Korba','Nabeul'),('Menzel Temime','Nabeul'),
  ('Bizerte','Bizerte'),('Menzel Bourguiba','Bizerte'),('Mateur','Bizerte'),('Ras Jebel','Bizerte'),
  ('Gabès','Gabès'),('El Hamma','Gabès'),('Mareth','Gabès'),
  ('Kairouan','Kairouan'),('Sbikha','Kairouan'),('Haffouz','Kairouan'),
  ('Monastir','Monastir'),('Ksar Hellal','Monastir'),('Moknine','Monastir'),('Jemmal','Monastir'),
  ('Médenine','Médenine'),('Zarzis','Médenine'),('Ben Gardane','Médenine'),('Djerba','Médenine'),('Houmt Souk','Médenine'),
  ('Béja','Béja'),('Téboursouk','Béja'),
  ('Jendouba','Jendouba'),('Tabarka','Jendouba'),('Aïn Draham','Jendouba'),
  ('Le Kef','Le Kef'),('Dahmani','Le Kef'),
  ('Siliana','Siliana'),('Bou Arada','Siliana'),
  ('Mahdia','Mahdia'),('Chebba','Mahdia'),('Ksour Essef','Mahdia'),
  ('Kasserine','Kasserine'),('Sbeitla','Kasserine'),('Fériana','Kasserine'),
  ('Sidi Bouzid','Sidi Bouzid'),('Regueb','Sidi Bouzid'),
  ('Gafsa','Gafsa'),('Métlaoui','Gafsa'),('Redeyef','Gafsa'),
  ('Tozeur','Tozeur'),('Nefta','Tozeur'),
  ('Kébili','Kébili'),('Douz','Kébili'),
  ('Tataouine','Tataouine'),('Ghomrassen','Tataouine'),
  ('Zaghouan','Zaghouan'),('El Fahs','Zaghouan')
ON CONFLICT (name, governorate) DO NOTHING;

-- ---------- VEHICLE CATEGORIES ----------
CREATE TABLE IF NOT EXISTS vehicle_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);
INSERT INTO vehicle_categories (name, position) VALUES
  ('Moto', 1), ('Scooter', 2), ('Quad', 3), ('Accessoires', 4), ('Pièces', 5)
ON CONFLICT (name) DO NOTHING;

-- ---------- ACCESSORY TYPES ----------
CREATE TABLE IF NOT EXISTS accessory_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);
INSERT INTO accessory_types (name, position) VALUES
  ('Casques', 1), ('Gants', 2), ('Vestes', 3), ('Pantalons', 4),
  ('Bottes', 5), ('Protections', 6), ('Antivols', 7), ('Bagagerie', 8),
  ('Électronique', 9), ('Entretien', 10), ('Pièces détachées', 11), ('Autre', 99)
ON CONFLICT (name) DO NOTHING;

-- ---------- GARAGE SPECIALTIES ----------
CREATE TABLE IF NOT EXISTS garage_specialties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);
INSERT INTO garage_specialties (name, position) VALUES
  ('Moto', 1), ('Scooter', 2), ('Quad', 3)
ON CONFLICT (name) DO NOTHING;

-- ---------- GARAGE SERVICES (catalog) ----------
CREATE TABLE IF NOT EXISTS garage_service_catalog (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);
INSERT INTO garage_service_catalog (name, position) VALUES
  ('Entretien courant (Vidange, filtres)', 1),
  ('Pneumatiques (Montage, équilibrage)', 2),
  ('Freinage (Plaquettes, disques, liquide)', 3),
  ('Kit chaîne / Transmission (Courroie, galets)', 4),
  ('Révision constructeur (Garantie préservée)', 5),
  ('Diagnostic électronique / Passage à la valise', 6),
  ('Électricité et Batterie', 7),
  ('Suspensions (Joints spi, vidange fourche)', 8),
  ('Moteur (Embrayage, soupapes, distribution)', 9),
  ('Carburation / Injection', 10),
  ('Bridage / Débridage (Permis A2)', 11),
  ('Pose d''accessoires et équipements', 12),
  ('Préparation contrôle technique', 13),
  ('Nettoyage et entretien esthétique', 14)
ON CONFLICT (name) DO NOTHING;
