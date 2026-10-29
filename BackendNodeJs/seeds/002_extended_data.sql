-- =====================================================================
-- 002_extended_data.sql
-- Extended seed data: more users, listings, garages, articles, tips,
-- tech specs, FAQs, reviews, ads, models, and previously-empty tables
-- (favorites, conversations, messages, notifications, garage reviews/services,
-- newsletter subscribers, contact messages, saved searches, reports).
--
-- Idempotent: every INSERT uses ON CONFLICT DO NOTHING or NOT EXISTS.
-- =====================================================================

-- =====================================================================
-- USERS — add 10 more (mix of buyers, sellers, pros, moderators)
-- =====================================================================
INSERT INTO users (id, email, full_name, seller_type, is_verified, avatar_url, phone, city, governorate, bio) VALUES
  ('44444444-4444-4444-4444-444444444444', 'anis.gharbi@moto-scoot.tn',     'Anis Gharbi',      'Particulier', TRUE,  'https://api.dicebear.com/7.x/initials/svg?seed=AG', '+216 22 111 222', 'Tunis',    'Tunis',   'Passionné de roadster japonais.'),
  ('55555555-5555-5555-5555-555555555555', 'leila.trabelsi@moto-scoot.tn',  'Leila Trabelsi',   'Particulier', TRUE,  'https://api.dicebear.com/7.x/initials/svg?seed=LT', '+216 23 222 333', 'Sousse',   'Sousse',  'Vespa addict depuis 2015.'),
  ('66666666-6666-6666-6666-666666666666', 'mehdi.bouaziz@moto-scoot.tn',   'Mehdi Bouaziz',    'Pro',         TRUE,  'https://api.dicebear.com/7.x/initials/svg?seed=MB', '+216 24 333 444', 'Sfax',     'Sfax',    'Concession multimarques Sfax.'),
  ('77777777-7777-7777-7777-777777777777', 'yassine.khelifi@moto-scoot.tn', 'Yassine Khelifi',  'Particulier', FALSE, 'https://api.dicebear.com/7.x/initials/svg?seed=YK', '+216 25 444 555', 'Bizerte',  'Bizerte', 'Premier achat moto.'),
  ('88888888-8888-8888-8888-888888888888', 'rania.mejri@moto-scoot.tn',     'Rania Mejri',      'Particulier', TRUE,  'https://api.dicebear.com/7.x/initials/svg?seed=RM', '+216 26 555 666', 'Nabeul',   'Nabeul',  'Scooter Tmax pour les trajets domicile-travail.'),
  ('99999999-9999-9999-9999-999999999999', 'hatem.zouari@moto-scoot.tn',    'Hatem Zouari',     'Pro',         TRUE,  'https://api.dicebear.com/7.x/initials/svg?seed=HZ', '+216 27 666 777', 'Monastir', 'Monastir','Atelier sportif et compétition.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nour.haddad@moto-scoot.tn',     'Nour Haddad',      'Particulier', TRUE,  'https://api.dicebear.com/7.x/initials/svg?seed=NH', '+216 28 777 888', 'Tunis',    'Tunis',   'Trail et voyage.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'sami.gargouri@moto-scoot.tn',   'Sami Gargouri',    'Particulier', FALSE, 'https://api.dicebear.com/7.x/initials/svg?seed=SG', '+216 29 888 999', 'Sfax',     'Sfax',    'Custom Harley.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ines.ferchichi@moto-scoot.tn',  'Ines Ferchichi',   'Particulier', TRUE,  'https://api.dicebear.com/7.x/initials/svg?seed=IF', '+216 50 111 222', 'Ariana',   'Ariana',  'Modératrice contenu.'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'oussama.belhaj@moto-scoot.tn',  'Oussama Belhaj',   'Pro',         TRUE,  'https://api.dicebear.com/7.x/initials/svg?seed=OB', '+216 50 222 333', 'Hammamet', 'Nabeul',  'Pneus & accessoires.')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role) VALUES
  ('44444444-4444-4444-4444-444444444444', 'user'),
  ('55555555-5555-5555-5555-555555555555', 'user'),
  ('66666666-6666-6666-6666-666666666666', 'pro'),
  ('77777777-7777-7777-7777-777777777777', 'user'),
  ('88888888-8888-8888-8888-888888888888', 'user'),
  ('99999999-9999-9999-9999-999999999999', 'pro'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'moderator'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'pro')
ON CONFLICT (user_id, role) DO NOTHING;

-- =====================================================================
-- LISTINGS — 18 additional listings across categories/cities/conditions
-- =====================================================================
INSERT INTO listings (
  user_id, title, description, brand, model, type, price, condition, year, mileage, cc, color,
  city, governorate, latitude, longitude, images, equipment, status, is_featured, deal_rating,
  published_at, expires_at
) VALUES
  ('44444444-4444-4444-4444-444444444444',
   'Yamaha R7 2023 — Sportive A2',
   'Yamaha R7 2023, parfaite pour piste et route. Échappement Akrapovic.',
   'Yamaha', 'R7', 'Moto', 26500, 'Excellent', 2023, 4200, 689, 'Bleu',
   'Tunis', 'Tunis', 36.8065, 10.1815,
   ARRAY['https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200','https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','Quickshifter','LED','Sabot moteur'],
   'active', TRUE, 3, NOW() - INTERVAL '1 day', NOW() + INTERVAL '60 days'),

  ('55555555-5555-5555-5555-555555555555',
   'Vespa Primavera 125',
   'Vespa Primavera 125, peinture beige, premier propriétaire.',
   'Vespa', 'Primavera 125', 'Scooter', 11500, 'Excellent', 2022, 6800, 125, 'Blanc',
   'Sousse', 'Sousse', 35.8245, 10.6346,
   ARRAY['https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=1200'],
   ARRAY['ABS','Top case'],
   'active', FALSE, 2, NOW() - INTERVAL '4 days', NOW() + INTERVAL '60 days'),

  ('66666666-6666-6666-6666-666666666666',
   'Triumph Street Triple RS',
   'Street Triple RS 765, dernier modèle. Encore sous garantie constructeur.',
   'Triumph', 'Street Triple RS', 'Moto', 38000, 'État neuf', 2024, 1500, 765, 'Vert',
   'Sfax', 'Sfax', 34.7406, 10.7603,
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','Quickshifter','TFT','Riding modes','LED'],
   'active', TRUE, 2, NOW() - INTERVAL '2 days', NOW() + INTERVAL '60 days'),

  ('66666666-6666-6666-6666-666666666666',
   'Aprilia RSV4 Factory',
   'Aprilia RSV4 Factory carbone, suspensions Öhlins, échappement SC-Project.',
   'Aprilia', 'RSV4 Factory', 'Moto', 65000, 'Excellent', 2022, 9500, 1099, 'Noir',
   'Sfax', 'Sfax', 34.7406, 10.7603,
   ARRAY['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'],
   ARRAY['ABS','Quickshifter','Carbone','Öhlins','LED'],
   'active', TRUE, 1, NOW() - INTERVAL '6 days', NOW() + INTERVAL '60 days'),

  ('77777777-7777-7777-7777-777777777777',
   'Honda CB500F',
   'Honda CB500F en très bon état, idéale pour permis A2.',
   'Honda', 'CB500F', 'Moto', 14500, 'Très bon', 2020, 19000, 471, 'Rouge',
   'Bizerte', 'Bizerte', 37.2744, 9.8739,
   ARRAY['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'],
   ARRAY['ABS','LED'],
   'active', FALSE, 2, NOW() - INTERVAL '3 days', NOW() + INTERVAL '60 days'),

  ('88888888-8888-8888-8888-888888888888',
   'Yamaha Tmax 560 Tech Max',
   'Tmax 560 Tech Max 2023 full options.',
   'Yamaha', 'Tmax 560', 'Scooter', 32000, 'Excellent', 2023, 8500, 562, 'Gris',
   'Nabeul', 'Nabeul', 36.4561, 10.7376,
   ARRAY['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200'],
   ARRAY['ABS','Régulateur','Chauffage poignées','TFT','Top case'],
   'active', TRUE, 3, NOW() - INTERVAL '1 day', NOW() + INTERVAL '60 days'),

  ('99999999-9999-9999-9999-999999999999',
   'KTM 1290 Super Duke R',
   'The Beast 2022, pneus neufs, échappement Akrapovic Evolution.',
   'KTM', '1290 Super Duke R', 'Moto', 48000, 'Excellent', 2022, 11000, 1301, 'Orange',
   'Monastir', 'Monastir', 35.7770, 10.8262,
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','Quickshifter','TFT','Modes','LED'],
   'active', TRUE, 2, NOW() - INTERVAL '5 days', NOW() + INTERVAL '60 days'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Honda Africa Twin 1100 DCT',
   'Africa Twin 1100 DCT, équipée voyage : valises, top case, GPS.',
   'Honda', 'Africa Twin 1100', 'Moto', 56000, 'Très bon', 2021, 26000, 1084, 'Blanc',
   'Tunis', 'Tunis', 36.8065, 10.1815,
   ARRAY['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'],
   ARRAY['ABS','Régulateur','Valises','Top case','GPS','LED'],
   'active', FALSE, 2, NOW() - INTERVAL '8 days', NOW() + INTERVAL '60 days'),

  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Harley-Davidson Fat Boy 114',
   'Fat Boy 114, sacoches en cuir, dossier passager, échappement Vance & Hines.',
   'Harley-Davidson', 'Fat Boy 114', 'Moto', 78000, 'Excellent', 2021, 14500, 1868, 'Noir',
   'Sfax', 'Sfax', 34.7406, 10.7603,
   ARRAY['https://images.unsplash.com/photo-1558980664-1db506751c0c?w=1200'],
   ARRAY['ABS','Sacoches','Pot sport','LED'],
   'active', TRUE, 1, NOW() - INTERVAL '9 days', NOW() + INTERVAL '60 days'),

  ('44444444-4444-4444-4444-444444444444',
   'Kawasaki Ninja 400',
   'Ninja 400, idéale jeune permis. Sortie échappement Yoshimura.',
   'Kawasaki', 'Ninja 400', 'Moto', 13800, 'Bon', 2019, 23000, 399, 'Vert',
   'Tunis', 'Tunis', 36.8065, 10.1815,
   ARRAY['https://images.unsplash.com/photo-1635073908681-b4dfb7d2db2d?w=1200'],
   ARRAY['ABS','LED'],
   'active', FALSE, 2, NOW() - INTERVAL '11 days', NOW() + INTERVAL '60 days'),

  ('55555555-5555-5555-5555-555555555555',
   'Kymco Like 125',
   'Scooter Kymco Like 125, design rétro, parfait usage urbain.',
   'Kymco', 'Like 125', 'Scooter', 4900, 'Bon', 2018, 24000, 125, 'Bleu',
   'Sousse', 'Sousse', 35.8245, 10.6346,
   ARRAY['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200'],
   ARRAY['Coffre'],
   'active', FALSE, 1, NOW() - INTERVAL '13 days', NOW() + INTERVAL '60 days'),

  ('66666666-6666-6666-6666-666666666666',
   'Ducati Panigale V4 S',
   'Panigale V4 S Öhlins, carénages carbone, échappement Akrapovic.',
   'Ducati', 'Panigale V4 S', 'Moto', 95000, 'Excellent', 2023, 3800, 1103, 'Rouge',
   'Sfax', 'Sfax', 34.7406, 10.7603,
   ARRAY['https://images.unsplash.com/photo-1580310614729-ccd69652491d?w=1200'],
   ARRAY['ABS','Quickshifter','Öhlins','Carbone','LED'],
   'active', TRUE, 1, NOW() - INTERVAL '4 days', NOW() + INTERVAL '60 days'),

  ('77777777-7777-7777-7777-777777777777',
   'Suzuki SV650',
   'SV650 fiable, entretien à jour, parfait débutant.',
   'Suzuki', 'SV650', 'Moto', 12500, 'Bon', 2018, 31000, 645, 'Noir',
   'Bizerte', 'Bizerte', 37.2744, 9.8739,
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','LED'],
   'active', FALSE, 2, NOW() - INTERVAL '14 days', NOW() + INTERVAL '60 days'),

  ('99999999-9999-9999-9999-999999999999',
   'Husqvarna Vitpilen 401',
   'Vitpilen 401 atypique, look café racer moderne.',
   'Husqvarna', 'Vitpilen 401', 'Moto', 17500, 'Très bon', 2021, 9500, 373, 'Blanc',
   'Monastir', 'Monastir', 35.7770, 10.8262,
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','LED'],
   'active', FALSE, 2, NOW() - INTERVAL '16 days', NOW() + INTERVAL '60 days'),

  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'SYM Joymax Z+ 300',
   'Joymax Z+ 300, scooter GT confortable, faible consommation.',
   'SYM', 'Joymax Z+ 300', 'Scooter', 13500, 'Excellent', 2022, 7800, 278, 'Gris',
   'Hammamet', 'Nabeul', 36.4017, 10.6225,
   ARRAY['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200'],
   ARRAY['ABS','Top case','Régulateur'],
   'active', FALSE, 2, NOW() - INTERVAL '5 days', NOW() + INTERVAL '60 days'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'BMW S 1000 RR',
   'S 1000 RR carbone, M Package, Akrapovic, suspensions DDC.',
   'BMW', 'S 1000 RR', 'Moto', 92000, 'Excellent', 2023, 5800, 999, 'Blanc',
   'Tunis', 'Tunis', 36.8065, 10.1815,
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','Quickshifter','M Package','Carbone','TFT','LED'],
   'active', TRUE, 1, NOW() - INTERVAL '7 days', NOW() + INTERVAL '60 days'),

  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'CFMOTO 700CL-X Sport',
   'CFMOTO 700CL-X Sport, néo-rétro abordable, équipement complet.',
   'CFMOTO', '700CL-X Sport', 'Moto', 18500, 'État neuf', 2024, 1200, 693, 'Argent',
   'Sfax', 'Sfax', 34.7406, 10.7603,
   ARRAY['https://images.unsplash.com/photo-1623057921892-0a35a01c6b97?w=1200'],
   ARRAY['ABS','TFT','LED'],
   'active', FALSE, 3, NOW() - INTERVAL '2 days', NOW() + INTERVAL '60 days'),

  ('66666666-6666-6666-6666-666666666666',
   'Casque Shoei NXR 2 — Neuf',
   'Casque intégral Shoei NXR 2 taille M, jamais utilisé, dans sa boîte.',
   'Shoei', 'NXR 2', 'Accessoires', 2200, 'Neuf', 2024, NULL, NULL, 'Noir',
   'Sfax', 'Sfax', 34.7406, 10.7603,
   ARRAY['https://images.unsplash.com/photo-1591637333472-cd9eb13e8e09?w=1200'],
   ARRAY[]::TEXT[],
   'active', FALSE, 3, NOW() - INTERVAL '1 day', NOW() + INTERVAL '60 days')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- GARAGES — 6 additional shops
-- =====================================================================
INSERT INTO garages (
  owner_id, name, description, address, city, governorate, phone, email, website,
  image, images, specialties, latitude, longitude, rating, reviews_count, is_verified, hours
) VALUES
  ('66666666-6666-6666-6666-666666666666',
   'Mehdi Motors Sfax',
   'Concession multimarques Honda, Yamaha, Suzuki. SAV agréé.',
   '78 Avenue Hedi Chaker', 'Sfax', 'Sfax',
   '+216 74 222 111', 'contact@mehdi-motors.tn', 'https://mehdi-motors.tn',
   'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200',
   ARRAY['https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200'],
   ARRAY['Concessionnaire','Multimarques','SAV'],
   34.7406, 10.7603, 4.5, 28, TRUE,
   'Lun-Ven: 9h-18h | Sam: 9h-13h'),

  ('99999999-9999-9999-9999-999999999999',
   'Hatem Racing Monastir',
   'Préparation circuit, pneus slick, suspensions Öhlins.',
   'Route de la Corniche', 'Monastir', 'Monastir',
   '+216 73 111 222', 'racing@hatemracing.tn', 'https://hatemracing.tn',
   'https://images.unsplash.com/photo-1623057921892-0a35a01c6b97?w=1200',
   ARRAY['https://images.unsplash.com/photo-1623057921892-0a35a01c6b97?w=1200'],
   ARRAY['Compétition','Suspensions','Pneumatiques'],
   35.7770, 10.8262, 4.9, 36, TRUE,
   'Lun-Sam: 9h-19h'),

  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'Pneus & Co Hammamet',
   'Pneumatiques Michelin, Pirelli, Bridgestone. Montage rapide.',
   'Avenue de la République', 'Hammamet', 'Nabeul',
   '+216 72 555 666', 'contact@pneus-co.tn', NULL,
   'https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=1200',
   ARRAY['https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=1200'],
   ARRAY['Pneumatiques','Montage','Équilibrage'],
   36.4017, 10.6225, 4.4, 17, TRUE,
   'Lun-Sam: 8h-19h'),

  (NULL,
   'Ducati Tunis Officiel',
   'Concessionnaire officiel Ducati. Vente, SAV, accessoires.',
   'Route X 20', 'Tunis', 'Tunis',
   '+216 71 999 888', 'tunis@ducati.tn', 'https://ducati.tn',
   'https://images.unsplash.com/photo-1580310614729-ccd69652491d?w=1200',
   ARRAY['https://images.unsplash.com/photo-1580310614729-ccd69652491d?w=1200'],
   ARRAY['Concessionnaire Ducati','SAV','Pièces'],
   36.8782, 10.3247, 4.7, 33, TRUE,
   'Lun-Ven: 9h-18h | Sam: 9h-13h'),

  (NULL,
   'KTM Center Sousse',
   'Concessionnaire KTM Sousse, Husqvarna, Gas Gas.',
   'Route de Tunis km 4', 'Sousse', 'Sousse',
   '+216 73 444 555', 'sousse@ktm.tn', 'https://ktm-sousse.tn',
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['Concessionnaire KTM','Husqvarna','Gas Gas'],
   35.8245, 10.6346, 4.6, 22, TRUE,
   'Lun-Ven: 9h-18h | Sam: 9h-13h'),

  (NULL,
   'Garage Custom Mahdia',
   'Préparation custom, peinture sur-mesure, café racer & bobber.',
   '15 Rue Ibn Khaldoun', 'Mahdia', 'Mahdia',
   '+216 73 666 777', 'custom@garage-mahdia.tn', NULL,
   'https://images.unsplash.com/photo-1558980664-1db506751c0c?w=1200',
   ARRAY['https://images.unsplash.com/photo-1558980664-1db506751c0c?w=1200'],
   ARRAY['Custom','Peinture','Café racer'],
   35.5047, 11.0622, 4.8, 14, FALSE,
   'Mar-Sam: 10h-18h')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- GARAGE REVIEWS — populate the empty garage_reviews table
-- =====================================================================
INSERT INTO garage_reviews (garage_id, user_id, rating, content, helpful_count)
SELECT g.id, u.id, r.rating, r.content, r.helpful
FROM (VALUES
  ('MotoCenter Tunis',     '44444444-4444-4444-4444-444444444444', 5, 'Travail impeccable, équipe pro et tarifs honnêtes.', 12),
  ('MotoCenter Tunis',     '55555555-5555-5555-5555-555555555555', 4, 'Bon accueil, délais respectés.', 5),
  ('Scoot Express Sousse', '88888888-8888-8888-8888-888888888888', 5, 'Mon scooter comme neuf, merci !', 8),
  ('Mehdi Motors Sfax',    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 4, 'Bon SAV, magasin propre.', 4),
  ('Hatem Racing Monastir','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5, 'Prépa circuit au top, conseils précieux.', 15),
  ('Ducati Tunis Officiel','44444444-4444-4444-4444-444444444444', 5, 'Concession sérieuse, vraiment Ducati spirit.', 10)
) AS r(garage_name, user_id, rating, content, helpful)
JOIN garages g ON g.name = r.garage_name
JOIN users u ON u.id = r.user_id::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM garage_reviews gr WHERE gr.garage_id = g.id AND gr.user_id = u.id
);

-- =====================================================================
-- GARAGE SERVICES — populate the empty garage_services table
-- =====================================================================
INSERT INTO garage_services (garage_id, name, price)
SELECT g.id, s.name, s.price
FROM (VALUES
  ('MotoCenter Tunis',      'Vidange complète',         '120 DT'),
  ('MotoCenter Tunis',      'Diagnostic électronique',  '60 DT'),
  ('MotoCenter Tunis',      'Changement plaquettes',    '90 DT'),
  ('Scoot Express Sousse',  'Révision scooter',         '80 DT'),
  ('Scoot Express Sousse',  'Changement courroie',      '150 DT'),
  ('Mehdi Motors Sfax',     'Révision constructeur',    '180 DT'),
  ('Mehdi Motors Sfax',     'Pneus avant + arrière',    'À partir de 320 DT'),
  ('Hatem Racing Monastir', 'Préparation circuit',      'Sur devis'),
  ('Hatem Racing Monastir', 'Suspension Öhlins',        'Sur devis'),
  ('Pneus Express Nabeul',  'Montage pneu',             '20 DT'),
  ('Pneus & Co Hammamet',   'Équilibrage',              '15 DT'),
  ('BMW Motorrad Tunis',    'Révision constructeur',    '350 DT')
) AS s(garage_name, name, price)
JOIN garages g ON g.name = s.garage_name
WHERE NOT EXISTS (
  SELECT 1 FROM garage_services gs WHERE gs.garage_id = g.id AND gs.name = s.name
);

-- =====================================================================
-- ARTICLES — 6 additional articles
-- =====================================================================
INSERT INTO articles (
  author_id, title, slug, summary, content, category, image, tags,
  is_featured, is_published, read_time, published_at
) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'KTM 1390 Super Duke R Evo : la bête évolue',
   'ktm-1390-super-duke-r-evo',
   'KTM dévoile la 1390 Super Duke R Evo avec un nouveau V2 1350 cm³ de 190 ch.',
   '<p>Le moteur LC8 passe à 1350 cm³ pour 190 ch et 145 Nm. Suspensions semi-actives WP APEX, écran TFT 8,8" connecté, et nouveau système de gestion électronique.</p>',
   'Nouveautés',
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   ARRAY['KTM','Roadster','Nouveauté 2025'],
   TRUE, TRUE, '5', NOW() - INTERVAL '1 day'),

  ('11111111-1111-1111-1111-111111111111',
   'Comparatif : Yamaha MT-09 vs Triumph Street Triple 765',
   'comparatif-mt09-street-triple',
   'Deux roadsters mid-size, deux philosophies. Lequel choisir ?',
   '<p>La MT-09 mise sur le caractère du tricylindre japonais et un prix agressif. La Street Triple 765 propose une finition supérieure et un châssis plus précis. Match serré.</p>',
   'Comparatif',
   'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200',
   ARRAY['Yamaha','Triumph','Comparatif','Roadster'],
   FALSE, TRUE, '8', NOW() - INTERVAL '4 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Salon EICMA 2025 : les nouveautés à retenir',
   'salon-eicma-2025',
   'Tour d''horizon des nouveautés présentées au salon de Milan.',
   '<p>EICMA 2025 a vu les présentations majeures de Yamaha, Honda, Ducati et BMW. Focus sur l''électrification, la connectivité et les aides à la conduite.</p>',
   'Actualités',
   'https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=1200',
   ARRAY['EICMA','Salon','Nouveautés'],
   TRUE, TRUE, '7', NOW() - INTERVAL '8 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Permis A2 vs A : tout comprendre',
   'permis-a2-vs-a-france',
   'Quelles différences, quel coût, quelles motos accessibles ?',
   '<p>Le permis A2 limite à 35 kW (47,5 ch). Après 2 ans, passage en A possible avec une formation de 7h. Coût moyen : 800-1200 € pour A2.</p>',
   'Législation',
   'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200',
   ARRAY['Permis','Législation','Débutant'],
   FALSE, TRUE, '5', NOW() - INTERVAL '12 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Top 10 des trails routiers 2024',
   'top-10-trails-routiers-2024',
   'BMW GS, Africa Twin, Multistrada, Tiger : notre classement.',
   '<p>De la BMW R 1300 GS à la KTM 890 Adventure, en passant par la Honda Africa Twin, voici les meilleurs trails routiers du marché.</p>',
   'Comparatif',
   'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200',
   ARRAY['Trail','Top 10','Voyage'],
   TRUE, TRUE, '10', NOW() - INTERVAL '18 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Tunisie : où rouler en moto ce week-end',
   'tunisie-itineraires-moto-week-end',
   '5 itinéraires moto pour découvrir la Tunisie sur deux roues.',
   '<p>De Tunis à Tabarka par la côte, le Cap Bon en boucle, Kairouan-Sbeitla par les terres : nos itinéraires testés et approuvés.</p>',
   'Voyage',
   'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200',
   ARRAY['Tunisie','Voyage','Itinéraire'],
   FALSE, TRUE, '6', NOW() - INTERVAL '22 days')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- TIPS — 5 additional tips
-- =====================================================================
INSERT INTO tips (
  author_id, title, slug, summary, content, category, difficulty, tools, image,
  read_time, is_published, published_at
) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'Hivernage moto : préparer sa machine pour l''hiver',
   'hivernage-moto',
   'Batterie, carburant, pneus : protégez votre moto pendant l''hiver.',
   '<p>Faites le plein avec un additif stabilisateur, branchez la batterie sur mainteneur, gonflez les pneus, lubrifiez la chaîne et couvrez la moto.</p>',
   'Entretien', 'Débutant',
   ARRAY['Mainteneur batterie','Stabilisateur','Housse'],
   'https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=1200',
   '6', TRUE, NOW() - INTERVAL '3 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Comment réussir sa courbe en moto',
   'reussir-courbe-moto',
   'Regard, contre-braquage, position : maîtrisez les virages.',
   '<p>Regardez loin dans la sortie de virage, accentuez le contre-braquage, déhanchez légèrement vers l''intérieur et conservez les gaz constants.</p>',
   'Conduite', 'Intermédiaire',
   ARRAY[]::TEXT[],
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   '5', TRUE, NOW() - INTERVAL '6 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Nettoyer le filtre à air à mousse',
   'nettoyer-filtre-air-mousse',
   'Un filtre propre, c''est de la performance et un moteur préservé.',
   '<p>Démontez le filtre, nettoyez-le à l''eau savonneuse tiède, séchez complètement, huilez avec une huile spécifique et remontez.</p>',
   'Entretien', 'Intermédiaire',
   ARRAY['Huile filtre','Eau savonneuse'],
   'https://images.unsplash.com/photo-1623057921892-0a35a01c6b97?w=1200',
   '4', TRUE, NOW() - INTERVAL '11 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Bien régler ses suspensions',
   'bien-regler-ses-suspensions',
   'Précharge, détente, compression : adaptez vos suspensions à votre poids et votre style.',
   '<p>Mesurez le sag (10-15% statique, 25-30% en charge), ajustez la précharge avant et arrière, puis affinez détente et compression.</p>',
   'Mécanique', 'Avancé',
   ARRAY['Mètre','Clés','Carnet de notes'],
   'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200',
   '9', TRUE, NOW() - INTERVAL '17 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Acheter d''occasion : check-list complète',
   'acheter-occasion-checklist',
   'Carte grise, carnet, cadre, fourche, freins : ne rien oublier avant l''achat.',
   '<p>Vérifiez carte grise, numéro de cadre, carnet d''entretien. Inspectez fourche, disques, plaquettes, chaîne, pneus. Essayez sur route.</p>',
   'Achat', 'Débutant',
   ARRAY['Lampe torche','Carnet'],
   'https://images.unsplash.com/photo-1591637333472-cd9eb13e8e09?w=1200',
   '7', TRUE, NOW() - INTERVAL '23 days')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- TECH SPECS — 7 additional tech sheets
-- =====================================================================
INSERT INTO tech_specs (
  brand, model, year, category, price_new, image, gallery,
  engine, chassis, electronics, dimensions, consumption, top_speed
) VALUES
  ('BMW', 'S 1000 RR', 2024, 'Sportive', '21 500 €',
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   '{"type":"4 cylindres en ligne","cylindree":"999 cm³","puissance":"210 ch à 13 750 tr/min","couple":"113 Nm à 11 000 tr/min"}'::jsonb,
   '{"cadre":"Aluminium pont","fourche":"Marzocchi 45 mm","freinAvant":"Double disque 320 mm","freinArriere":"Disque 220 mm"}'::jsonb,
   '{"abs":"Oui Pro","tractionControl":"Oui DTC","modes":"4 modes + Pro"}'::jsonb,
   '{"longueur":"2073 mm","largeur":"848 mm","poids":"196,5 kg","reservoir":"16,5 L"}'::jsonb,
   '6,4 L/100km', '299 km/h'),

  ('Ducati', 'Panigale V4 S', 2024, 'Sportive', '29 990 €',
   'https://images.unsplash.com/photo-1580310614729-ccd69652491d?w=1200',
   ARRAY['https://images.unsplash.com/photo-1580310614729-ccd69652491d?w=1200'],
   '{"type":"V4 90°","cylindree":"1103 cm³","puissance":"215,5 ch à 13 000 tr/min","couple":"123,6 Nm à 9 500 tr/min"}'::jsonb,
   '{"cadre":"Front Frame aluminium","fourche":"Öhlins NIX-30","freinAvant":"Double disque 330 mm Brembo Stylema","freinArriere":"Disque 245 mm"}'::jsonb,
   '{"abs":"Oui Cornering","tractionControl":"Oui DTC EVO 3","modes":"4 modes Riding"}'::jsonb,
   '{"longueur":"2065 mm","largeur":"785 mm","poids":"195 kg","reservoir":"17 L"}'::jsonb,
   '6,5 L/100km', '299 km/h'),

  ('KTM', '1290 Super Duke R', 2024, 'Roadster', '20 590 €',
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   '{"type":"V2 75°","cylindree":"1301 cm³","puissance":"180 ch à 9 500 tr/min","couple":"140 Nm à 8 000 tr/min"}'::jsonb,
   '{"cadre":"Treillis acier","fourche":"WP APEX 48 mm","freinAvant":"Double disque 320 mm Brembo Stylema","freinArriere":"Disque 240 mm"}'::jsonb,
   '{"abs":"Oui Cornering","tractionControl":"Oui MTC","modes":"4 modes"}'::jsonb,
   '{"longueur":"2095 mm","largeur":"820 mm","poids":"189 kg","reservoir":"16 L"}'::jsonb,
   '5,9 L/100km', '290 km/h'),

  ('BMW', 'R 1250 GS', 2024, 'Trail', '20 850 €',
   'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200',
   ARRAY['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'],
   '{"type":"Bicylindre Boxer","cylindree":"1254 cm³","puissance":"136 ch à 7 750 tr/min","couple":"143 Nm à 6 250 tr/min"}'::jsonb,
   '{"cadre":"Treillis tubulaire acier","fourche":"Telelever","freinAvant":"Double disque 305 mm","freinArriere":"Disque 276 mm"}'::jsonb,
   '{"abs":"Oui Pro","tractionControl":"Oui ASC","modes":"4 modes Pro"}'::jsonb,
   '{"longueur":"2207 mm","largeur":"952 mm","poids":"249 kg","reservoir":"20 L"}'::jsonb,
   '4,8 L/100km', '220 km/h'),

  ('Honda', 'Africa Twin 1100', 2024, 'Trail', '15 199 €',
   'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200',
   ARRAY['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'],
   '{"type":"Bicylindre en ligne","cylindree":"1084 cm³","puissance":"102 ch à 7 500 tr/min","couple":"105 Nm à 6 250 tr/min"}'::jsonb,
   '{"cadre":"Treillis acier","fourche":"Showa 45 mm","freinAvant":"Double disque 310 mm","freinArriere":"Disque 256 mm"}'::jsonb,
   '{"abs":"Oui Cornering","tractionControl":"Oui HSTC","modes":"4 modes + custom"}'::jsonb,
   '{"longueur":"2330 mm","largeur":"960 mm","poids":"238 kg","reservoir":"24,8 L"}'::jsonb,
   '4,9 L/100km', '210 km/h'),

  ('Yamaha', 'Tmax 560', 2024, 'Scooter', '13 599 €',
   'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200',
   ARRAY['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200'],
   '{"type":"Bicylindre en ligne","cylindree":"562 cm³","puissance":"47,6 ch à 7 500 tr/min","couple":"55,7 Nm à 5 250 tr/min"}'::jsonb,
   '{"cadre":"Diamant aluminium","fourche":"Téléhydraulique 41 mm","freinAvant":"Double disque 267 mm","freinArriere":"Disque 282 mm"}'::jsonb,
   '{"abs":"Oui","tractionControl":"Oui TCS","modes":"Non"}'::jsonb,
   '{"longueur":"2200 mm","largeur":"765 mm","poids":"218 kg","reservoir":"15 L"}'::jsonb,
   '5,1 L/100km', '180 km/h'),

  ('Vespa', 'GTS 310', 2024, 'Scooter', '6 999 €',
   'https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=1200',
   ARRAY['https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=1200'],
   '{"type":"Monocylindre","cylindree":"310 cm³","puissance":"26 ch à 7 250 tr/min","couple":"26 Nm à 5 250 tr/min"}'::jsonb,
   '{"cadre":"Monocoque acier","fourche":"Bras tiré","freinAvant":"Disque 220 mm","freinArriere":"Disque 220 mm"}'::jsonb,
   '{"abs":"Oui","tractionControl":"Oui ASR","modes":"Non"}'::jsonb,
   '{"longueur":"1950 mm","largeur":"770 mm","poids":"160 kg","reservoir":"7 L"}'::jsonb,
   '3,4 L/100km', '125 km/h')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- FAQ — 8 additional entries across categories
-- =====================================================================
INSERT INTO faqs (question, answer, category, position, is_published) VALUES
  ('Puis-je modifier mon annonce après publication ?',
   'Oui, depuis votre tableau de bord > Mes annonces, cliquez sur Modifier. Les changements sont appliqués immédiatement.',
   'Annonces', 3, TRUE),
  ('Comment booster mon annonce ?',
   'Depuis Mes annonces, cliquez sur Booster. Choisissez un pack (3, 7 ou 30 jours) et payez en ligne.',
   'Annonces', 4, TRUE),
  ('Quels moyens de paiement acceptez-vous ?',
   'Carte bancaire (Visa, Mastercard) et virement bancaire pour les packs pro.',
   'Paiement', 1, TRUE),
  ('Comment se passe la livraison ?',
   'MotoScoot est une plateforme de mise en relation. La livraison ou le retrait se fait directement entre acheteur et vendeur.',
   'Acheter', 2, TRUE),
  ('Existe-t-il un compte Pro ?',
   'Oui, un compte Pro est dédié aux professionnels. Il offre une vitrine, des annonces illimitées et des statistiques avancées.',
   'Compte', 2, TRUE),
  ('Comment vérifier l''authenticité d''un vendeur ?',
   'Recherchez le badge Vérifié sur le profil. Privilégiez les rendez-vous physiques en lieu public.',
   'Sécurité', 2, TRUE),
  ('Puis-je vendre des accessoires sans moto ?',
   'Oui, sélectionnez la catégorie Accessoires lors du dépôt d''annonce.',
   'Annonces', 5, TRUE),
  ('Comment recevoir des alertes pour des nouvelles annonces ?',
   'Effectuez une recherche, puis cliquez sur Sauvegarder. Vous recevrez un email dès qu''une annonce correspond.',
   'Acheter', 3, TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- SITE REVIEWS — 6 additional testimonials
-- =====================================================================
INSERT INTO site_reviews (user_id, name, role, avatar_url, content, rating, is_published) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Anis G.', 'Acheteur', 'https://api.dicebear.com/7.x/initials/svg?seed=AG',
   'Trouvé ma R7 en 3 jours. Vendeur pro, transaction facile.', 5, TRUE),
  ('55555555-5555-5555-5555-555555555555', 'Leila T.', 'Vendeuse', 'https://api.dicebear.com/7.x/initials/svg?seed=LT',
   'Vendu ma Vespa rapidement, beaucoup de contacts sérieux.', 5, TRUE),
  ('66666666-6666-6666-6666-666666666666', 'Mehdi B.', 'Pro', 'https://api.dicebear.com/7.x/initials/svg?seed=MB',
   'Plateforme idéale pour notre concession, statistiques au top.', 5, TRUE),
  (NULL, 'Sabrine R.', 'Acheteuse', NULL,
   'J''ai pu comparer plusieurs scooters facilement. Excellente UX.', 4, TRUE),
  (NULL, 'Tarek M.', 'Acheteur', NULL,
   'Site rapide, photos de qualité. Quelques annonces sans prix indicatif dommage.', 4, TRUE),
  (NULL, 'Fatma B.', 'Vendeuse', NULL,
   'L''option boost a vraiment fait la différence pour vendre vite.', 5, TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- AD CAMPAIGNS — 4 additional active campaigns
-- =====================================================================
INSERT INTO ad_campaigns (
  title, client, zone, description, media_type, media_url, link_url, cta_text,
  start_date, end_date, is_active
) VALUES
  ('Équipement Dainese -15%', 'Dainese', 'garage_sidebar',
   'Combinaisons et blousons Dainese à -15% jusqu''à fin du mois.',
   'Image', 'https://images.unsplash.com/photo-1591637333472-cd9eb13e8e09?w=800',
   'https://example.com/dainese', 'Profiter',
   CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE + INTERVAL '60 days', TRUE),

  ('Crédit Moto BIAT', 'BIAT', 'search_feed',
   'Financez votre moto à partir de 4,9% TAEG fixe.',
   'Image', 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1600',
   'https://example.com/biat', 'Simuler',
   CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE + INTERVAL '90 days', TRUE),

  ('Stage de pilotage Kébili', 'KartingKebili', 'news_top',
   'Stages de pilotage moto sur circuit. Initiation et perfectionnement.',
   'Image', 'https://images.unsplash.com/photo-1623057921892-0a35a01c6b97?w=1600',
   'https://example.com/karting', 'Réserver',
   CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '50 days', TRUE),

  ('Pneus Pirelli Diablo Rosso', 'Pirelli', 'listing_sidebar',
   'Le Pirelli Diablo Rosso IV, performance pure pour vos sorties sportives.',
   'Image', 'https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=800',
   'https://example.com/pirelli', 'Découvrir',
   CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE + INTERVAL '70 days', TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- FAVORITES — link some users to listings
-- =====================================================================
INSERT INTO favorites (user_id, listing_id)
SELECT u.id, l.id
FROM users u
CROSS JOIN LATERAL (
  SELECT id FROM listings ORDER BY random() LIMIT 5
) l
WHERE u.email IN (
  'anis.gharbi@moto-scoot.tn','leila.trabelsi@moto-scoot.tn',
  'yassine.khelifi@moto-scoot.tn','rania.mejri@moto-scoot.tn',
  'nour.haddad@moto-scoot.tn'
)
ON CONFLICT (user_id, listing_id) DO NOTHING;

-- =====================================================================
-- CONVERSATIONS + MESSAGES — sample chats between buyers and sellers
-- =====================================================================
INSERT INTO conversations (id, listing_id, buyer_id, seller_id, last_message_at, buyer_unread, seller_unread)
SELECT
  gen_random_uuid(),
  l.id,
  '44444444-4444-4444-4444-444444444444',
  l.user_id,
  NOW() - INTERVAL '1 hour',
  0, 1
FROM listings l
WHERE l.title = 'Yamaha MT-07 2022 — Comme neuve'
  AND NOT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.listing_id = l.id
      AND c.buyer_id = '44444444-4444-4444-4444-444444444444'
      AND c.seller_id = l.user_id
  )
LIMIT 1;

INSERT INTO conversations (id, listing_id, buyer_id, seller_id, last_message_at, buyer_unread, seller_unread)
SELECT
  gen_random_uuid(),
  l.id,
  '77777777-7777-7777-7777-777777777777',
  l.user_id,
  NOW() - INTERVAL '4 hours',
  1, 0
FROM listings l
WHERE l.title = 'Honda PCX 125 — 2023'
  AND NOT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.listing_id = l.id
      AND c.buyer_id = '77777777-7777-7777-7777-777777777777'
      AND c.seller_id = l.user_id
  )
LIMIT 1;

INSERT INTO conversations (id, listing_id, buyer_id, seller_id, last_message_at, buyer_unread, seller_unread)
SELECT
  gen_random_uuid(),
  l.id,
  '88888888-8888-8888-8888-888888888888',
  l.user_id,
  NOW() - INTERVAL '30 minutes',
  0, 2
FROM listings l
WHERE l.title = 'Kawasaki Z900 2021'
  AND NOT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.listing_id = l.id
      AND c.buyer_id = '88888888-8888-8888-8888-888888888888'
      AND c.seller_id = l.user_id
  )
LIMIT 1;

-- Messages for the conversations created above (only insert if conversation has none yet)
INSERT INTO messages (conversation_id, sender_id, type, content, is_read, created_at)
SELECT c.id, c.buyer_id, 'text', 'Bonjour, est-ce que la moto est toujours disponible ?', TRUE, NOW() - INTERVAL '2 hours'
FROM conversations c
WHERE c.buyer_id = '44444444-4444-4444-4444-444444444444'
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id);

INSERT INTO messages (conversation_id, sender_id, type, content, is_read, created_at)
SELECT c.id, c.seller_id, 'text', 'Bonjour, oui elle est dispo. Vous pouvez la voir ce week-end ?', TRUE, NOW() - INTERVAL '1 hour 30 minutes'
FROM conversations c
WHERE c.buyer_id = '44444444-4444-4444-4444-444444444444'
  AND (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) = 1;

INSERT INTO messages (conversation_id, sender_id, type, content, is_read, created_at)
SELECT c.id, c.buyer_id, 'offer', 'Je propose 27 000 DT, ça vous intéresse ?', FALSE, NOW() - INTERVAL '1 hour'
FROM conversations c
WHERE c.buyer_id = '44444444-4444-4444-4444-444444444444'
  AND (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) = 2;

INSERT INTO messages (conversation_id, sender_id, type, content, is_read, created_at)
SELECT c.id, c.buyer_id, 'text', 'Bonjour, encore en vente ? Je suis intéressé.', FALSE, NOW() - INTERVAL '4 hours'
FROM conversations c
WHERE c.buyer_id = '77777777-7777-7777-7777-777777777777'
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id);

INSERT INTO messages (conversation_id, sender_id, type, content, is_read, created_at)
SELECT c.id, c.buyer_id, 'text', 'Bonjour, la Z900 est-elle négociable ?', TRUE, NOW() - INTERVAL '1 hour'
FROM conversations c
WHERE c.buyer_id = '88888888-8888-8888-8888-888888888888'
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id);

INSERT INTO messages (conversation_id, sender_id, type, content, is_read, created_at)
SELECT c.id, c.buyer_id, 'text', 'Et est-ce que la révision a été faite récemment ?', FALSE, NOW() - INTERVAL '30 minutes'
FROM conversations c
WHERE c.buyer_id = '88888888-8888-8888-8888-888888888888'
  AND (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) = 1;

-- =====================================================================
-- NOTIFICATIONS — sample notifications across types
-- =====================================================================
INSERT INTO notifications (user_id, type, title, body, link, is_read)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'message',        'Nouveau message',           'Anis Gharbi vous a envoyé un message sur votre Yamaha MT-07.', '/dashboard/messages', FALSE),
  ('22222222-2222-2222-2222-222222222222', 'favorite',       'Annonce ajoutée en favori', 'Votre Yamaha MT-07 a été ajoutée aux favoris.',                  '/dashboard/my-ads',   FALSE),
  ('22222222-2222-2222-2222-222222222222', 'listing_view',   'Pic de vues',               'Votre annonce Honda PCX a dépassé 100 vues.',                    '/dashboard/my-ads',   TRUE),
  ('33333333-3333-3333-3333-333333333333', 'review',         'Nouvel avis',               'Vous avez reçu un avis 5★ sur Sami Garage.',                     '/garages',            FALSE),
  ('44444444-4444-4444-4444-444444444444', 'system',         'Bienvenue sur MotoScoot',   'Votre compte a été créé avec succès.',                            '/',                   TRUE),
  ('55555555-5555-5555-5555-555555555555', 'article',        'Nouvel article',            'Yamaha dévoile la nouvelle MT-09 2025.',                          '/news',               FALSE),
  ('66666666-6666-6666-6666-666666666666', 'listing_status', 'Annonce approuvée',         'Votre Triumph Street Triple RS est en ligne.',                    '/dashboard/my-ads',   TRUE),
  ('77777777-7777-7777-7777-777777777777', 'tip',            'Conseil pour vous',         'Comment réussir sa courbe en moto.',                              '/tips',               FALSE),
  ('88888888-8888-8888-8888-888888888888', 'offer',          'Nouvelle offre',            'Vous avez reçu une offre de 27 000 DT.',                          '/dashboard/messages', FALSE),
  ('99999999-9999-9999-9999-999999999999', 'ad',             'Campagne lancée',           'Votre campagne Hatem Racing est en ligne.',                       '/admin/ads',          TRUE);

-- =====================================================================
-- SAVED SEARCHES — alerts for buyers
-- =====================================================================
INSERT INTO saved_searches (user_id, name, filters, alert_enabled)
VALUES
  ('44444444-4444-4444-4444-444444444444', 'Roadster < 30k DT',
   '{"type":"Moto","max_price":30000,"sort":"newest"}'::jsonb, TRUE),
  ('77777777-7777-7777-7777-777777777777', 'Honda CB 500',
   '{"brand":"Honda","model":"CB500F"}'::jsonb, TRUE),
  ('88888888-8888-8888-8888-888888888888', 'Tmax récents',
   '{"brand":"Yamaha","model":"Tmax 560","min_year":2022}'::jsonb, TRUE),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Trail BMW/Honda',
   '{"type":"Moto","brand":"BMW","min_price":40000}'::jsonb, TRUE);

-- =====================================================================
-- NEWSLETTER SUBSCRIBERS — populate empty newsletter table
-- =====================================================================
INSERT INTO newsletter_subscribers (email) VALUES
  ('newsletter1@example.com'),('newsletter2@example.com'),('newsletter3@example.com'),
  ('amine.bouhali@example.com'),('chiraz.maaroufi@example.com'),('khalil.zribi@example.com'),
  ('nadia.khemiri@example.com'),('rim.belhadj@example.com'),('seif.gargouri@example.com'),
  ('zied.mansouri@example.com'),('houda.naceur@example.com'),('lassad.dridi@example.com')
ON CONFLICT (email) DO NOTHING;

-- =====================================================================
-- CONTACT MESSAGES — sample inbox messages
-- =====================================================================
INSERT INTO contact_messages (name, email, subject, message, is_resolved) VALUES
  ('Mohamed Ali','mohamed.ali@example.com','Question sur le boost','Bonjour, comment fonctionne le pack boost 7 jours ? Merci.',                  FALSE),
  ('Sonia M.','sonia.m@example.com','Problème de connexion','Je n''arrive pas à me connecter avec mon email, pouvez-vous m''aider ?',           FALSE),
  ('Amine Z.','amine.z@example.com','Suggestion de fonctionnalité','Serait-il possible d''ajouter un filtre par couleur ?',                       FALSE),
  ('Walid F.','walid.f@example.com','Annonce frauduleuse','Je signale une annonce qui me semble frauduleuse (lien dans le message).',             FALSE),
  ('Hela S.','hela.s@example.com','Compte Pro','Bonjour, j''aimerais souscrire un compte Pro pour ma concession. Quelles sont les modalités ?',  FALSE),
  ('Karim B.','karim.b@example.com','Merci pour le service','Juste pour vous remercier, transaction parfaite !',                                   TRUE);

-- =====================================================================
-- REPORTS — populate the empty reports table
-- =====================================================================
INSERT INTO reports (reporter_id, listing_id, reason, details, is_resolved)
SELECT
  '44444444-4444-4444-4444-444444444444'::uuid,
  l.id,
  'spam'::report_reason,
  'Annonce republiée plusieurs fois.',
  FALSE
FROM listings l
WHERE l.title = 'Suzuki GSX-R 600'
  AND NOT EXISTS (
    SELECT 1 FROM reports r
    WHERE r.listing_id = l.id AND r.reporter_id = '44444444-4444-4444-4444-444444444444'
  )
LIMIT 1;

INSERT INTO reports (reporter_id, listing_id, reason, details, is_resolved)
SELECT
  '55555555-5555-5555-5555-555555555555'::uuid,
  l.id,
  'wrong_category'::report_reason,
  'Cet accessoire est dans la mauvaise catégorie.',
  FALSE
FROM listings l
WHERE l.title = 'Casque Shoei NXR 2 — Neuf'
  AND NOT EXISTS (
    SELECT 1 FROM reports r
    WHERE r.listing_id = l.id AND r.reporter_id = '55555555-5555-5555-5555-555555555555'
  )
LIMIT 1;

-- =====================================================================
-- MODELS — populate the empty models reference table
-- =====================================================================
INSERT INTO models (brand_id, name, category)
SELECT b.id, m.name, m.category
FROM (VALUES
  ('Yamaha','MT-07','Roadster'),('Yamaha','MT-09','Roadster'),('Yamaha','R7','Sportive'),
  ('Yamaha','R1','Sportive'),('Yamaha','Tmax 560','Scooter'),('Yamaha','Tracer 9','Trail'),
  ('Honda','CB650R','Roadster'),('Honda','CB500F','Roadster'),('Honda','PCX 125','Scooter'),
  ('Honda','Africa Twin 1100','Trail'),('Honda','CBR650R','Sportive'),('Honda','Forza 125','Scooter'),
  ('Kawasaki','Z900','Roadster'),('Kawasaki','Ninja 400','Sportive'),('Kawasaki','Ninja 650','Sportive'),
  ('Kawasaki','Versys 650','Trail'),('Kawasaki','Z650','Roadster'),
  ('Suzuki','SV650','Roadster'),('Suzuki','GSX-R 600','Sportive'),('Suzuki','GSX-S 750','Roadster'),
  ('Suzuki','V-Strom 650','Trail'),
  ('BMW','S 1000 RR','Sportive'),('BMW','R 1250 GS','Trail'),('BMW','F 900 R','Roadster'),
  ('BMW','CE 04','Scooter'),('BMW','M 1000 RR','Sportive'),
  ('Ducati','Monster 821','Roadster'),('Ducati','Panigale V4 S','Sportive'),
  ('Ducati','Multistrada V4','Trail'),('Ducati','Streetfighter V4','Roadster'),
  ('KTM','Duke 390','Roadster'),('KTM','1290 Super Duke R','Roadster'),
  ('KTM','890 Adventure','Trail'),('KTM','RC 390','Sportive'),
  ('Harley-Davidson','Iron 883','Custom'),('Harley-Davidson','Fat Boy 114','Custom'),
  ('Harley-Davidson','Street Glide','Touring'),
  ('Triumph','Street Triple RS','Roadster'),('Triumph','Tiger 900','Trail'),
  ('Triumph','Speed Triple 1200 RS','Roadster'),
  ('Aprilia','RSV4 Factory','Sportive'),('Aprilia','Tuono V4','Roadster'),('Aprilia','RS 660','Sportive'),
  ('Vespa','Primavera 125','Scooter'),('Vespa','GTS 300','Scooter'),('Vespa','Sprint 125','Scooter'),
  ('Piaggio','Liberty 125','Scooter'),('Piaggio','MP3 530','Scooter'),
  ('Kymco','Like 125','Scooter'),('Kymco','AK 550','Scooter'),
  ('SYM','Joymax Z+ 300','Scooter'),('SYM','Maxsym 400','Scooter'),
  ('Royal Enfield','Classic 350','Custom'),('Royal Enfield','Continental GT 650','Café Racer'),
  ('Husqvarna','Vitpilen 401','Roadster'),('Husqvarna','Svartpilen 401','Roadster'),
  ('CFMOTO','700CL-X Sport','Roadster'),('CFMOTO','800MT','Trail'),
  ('Benelli','TRK 502','Trail'),('Benelli','Leoncino 500','Roadster'),
  ('Zero','SR/F','Roadster')
) AS m(brand_name, name, category)
JOIN brands b ON b.name = m.brand_name
ON CONFLICT (brand_id, name) DO NOTHING;

-- =====================================================================
-- EQUIPMENT — extend reference equipment list
-- =====================================================================
INSERT INTO equipment (name, category) VALUES
  ('Quickshifter','performance'),('Riding modes','électronique'),('TFT couleur','électronique'),
  ('Connectivité smartphone','électronique'),('IMU 6 axes','sécurité'),
  ('Suspensions Öhlins','performance'),('Échappement Akrapovic','performance'),
  ('Sabot moteur','protection'),('Crash bar','protection'),
  ('Valises latérales','rangement'),('Selle confort','confort'),
  ('Régulateur de vitesse','confort'),('Démarrage sans clé','confort'),
  ('Sacoches cuir','rangement'),('Carbone','performance')
ON CONFLICT (name) DO NOTHING;

-- =====================================================================
-- LISTING VIEWS / CONTACTS / SHARES — synthetic activity
-- =====================================================================
-- Add ~5 contacts per active listing
INSERT INTO listing_contacts (listing_id, channel, created_at)
SELECT l.id,
       (ARRAY['call','sms','whatsapp','message','email']::contact_channel[])[1 + floor(random()*5)::int],
       NOW() - (random() * INTERVAL '20 days')
FROM listings l, generate_series(1, 5)
WHERE l.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM listing_contacts lc WHERE lc.listing_id = l.id);

-- Add ~3 shares per active listing
INSERT INTO listing_shares (listing_id, platform, created_at)
SELECT l.id,
       (ARRAY['facebook','whatsapp','copy','twitter','instagram'])[1 + floor(random()*5)::int],
       NOW() - (random() * INTERVAL '20 days')
FROM listings l, generate_series(1, 3)
WHERE l.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM listing_shares ls WHERE ls.listing_id = l.id);

-- Sync aggregate counters from event tables
UPDATE listings l
SET contacts_count = (SELECT COUNT(*) FROM listing_contacts c WHERE c.listing_id = l.id),
    shares_count   = (SELECT COUNT(*) FROM listing_shares   s WHERE s.listing_id = l.id),
    favorites_count= (SELECT COUNT(*) FROM favorites        f WHERE f.listing_id = l.id);

-- =====================================================================
-- VISITOR SESSIONS + LISTING VIEWS — analytics seed
-- =====================================================================
INSERT INTO visitor_sessions (fingerprint, ip_address, country, city, device, browser, os, referral_source, landing_page, duration_seconds, pages_viewed, started_at)
SELECT
  md5('seed-' || g)::varchar,
  ('41.231.' || (1 + floor(random()*254)::int) || '.' || (1 + floor(random()*254)::int))::inet,
  'Tunisia',
  (ARRAY['Tunis','Sfax','Sousse','Nabeul','Bizerte'])[1 + floor(random()*5)::int],
  (ARRAY['mobile','desktop','tablet'])[1 + floor(random()*3)::int],
  (ARRAY['Chrome','Safari','Firefox','Edge'])[1 + floor(random()*4)::int],
  (ARRAY['Android','iOS','Windows','macOS'])[1 + floor(random()*4)::int],
  (ARRAY['direct','google','facebook','instagram','whatsapp'])[1 + floor(random()*5)::int]::referral_source,
  (ARRAY['/','/search','/news','/garages'])[1 + floor(random()*4)::int],
  60 + floor(random()*900)::int,
  1 + floor(random()*8)::int,
  NOW() - (random() * INTERVAL '30 days')
FROM generate_series(1, 50) g
WHERE (SELECT COUNT(*) FROM visitor_sessions) < 30;

-- =====================================================================
-- AD IMPRESSIONS / CLICKS — synthetic ad activity
-- =====================================================================
INSERT INTO ad_impressions (campaign_id, created_at)
SELECT c.id, NOW() - (random() * INTERVAL '20 days')
FROM ad_campaigns c, generate_series(1, 25)
WHERE c.is_active = TRUE
  AND NOT EXISTS (SELECT 1 FROM ad_impressions i WHERE i.campaign_id = c.id);

INSERT INTO ad_clicks (campaign_id, created_at)
SELECT c.id, NOW() - (random() * INTERVAL '20 days')
FROM ad_campaigns c, generate_series(1, 4)
WHERE c.is_active = TRUE
  AND NOT EXISTS (SELECT 1 FROM ad_clicks k WHERE k.campaign_id = c.id);

-- Sync aggregate ad counters
UPDATE ad_campaigns ac
SET views  = (SELECT COUNT(*) FROM ad_impressions i WHERE i.campaign_id = ac.id),
    clicks = (SELECT COUNT(*) FROM ad_clicks      k WHERE k.campaign_id = ac.id);

-- =====================================================================
-- Refresh listings random counters for all listings (including new)
-- =====================================================================
UPDATE listings SET views_count = floor(random() * 800 + 50)::int
WHERE views_count = 0 OR views_count IS NULL;

UPDATE articles SET views_count   = floor(random() * 3000 + 200)::int,
                    likes_count   = floor(random() * 120)::int,
                    comments_count= floor(random() * 25)::int
WHERE views_count = 0 OR views_count IS NULL;

UPDATE tips SET views_count    = floor(random() * 2000 + 100)::int,
                likes_count    = floor(random() * 90)::int,
                bookmarks_count= floor(random() * 40)::int
WHERE views_count = 0 OR views_count IS NULL;
