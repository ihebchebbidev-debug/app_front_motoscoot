-- =====================================================================
-- 001_sample_data.sql
-- Seed sample listings, articles, tips, garages, FAQs, site reviews
-- and ad campaigns so the app's read endpoints return real data.
--
-- Idempotent: safe to run multiple times (uses ON CONFLICT / NOT EXISTS).
-- =====================================================================

-- =====================================================================
-- Seed users (one "system" author, one demo seller, one demo pro)
-- Password column is NULL — these are content-only fixtures.
-- Schema reference: users(full_name, avatar_url, seller_type). Roles live in user_roles.
-- =====================================================================
INSERT INTO users (id, email, full_name, seller_type, is_verified, avatar_url)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'editorial@moto-scoot.tn',  'Équipe MotoScoot', 'Particulier', TRUE,
   'https://api.dicebear.com/7.x/initials/svg?seed=MS'),
  ('22222222-2222-2222-2222-222222222222', 'demo.seller@moto-scoot.tn', 'Karim Ben Salah', 'Particulier', TRUE,
   'https://api.dicebear.com/7.x/initials/svg?seed=KB'),
  ('33333333-3333-3333-3333-333333333333', 'demo.pro@moto-scoot.tn',    'Sami Garage',     'Pro',         TRUE,
   'https://api.dicebear.com/7.x/initials/svg?seed=SG')
ON CONFLICT (email) DO NOTHING;

-- Assign roles via the user_roles table (avoids privilege escalation on profile)
INSERT INTO user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'user'),
  ('33333333-3333-3333-3333-333333333333', 'pro')
ON CONFLICT (user_id, role) DO NOTHING;

-- =====================================================================
-- LISTINGS — 12 sample motorcycles / scooters across categories
-- =====================================================================
INSERT INTO listings (
  user_id, title, description, brand, model, type, price, condition, year, mileage, cc, color,
  city, governorate, images, equipment, status, is_featured, deal_rating, published_at, expires_at
) VALUES
  ('22222222-2222-2222-2222-222222222222',
   'Yamaha MT-07 2022 — Comme neuve',
   'Yamaha MT-07 en parfait état, première main, entretien suivi chez le concessionnaire. Pneus neufs, vidange récente.',
   'Yamaha', 'MT-07', 'Moto', 28500, 'Excellent', 2022, 8500, 689, 'Bleu',
   'Tunis', 'Tunis',
   ARRAY['https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200','https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','Selle confort','Top case'],
   'active', TRUE, 3, NOW() - INTERVAL '2 days', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'Honda PCX 125 — 2023',
   'Scooter Honda PCX 125 cc, idéal pour la ville. Très peu roulé, encore sous garantie.',
   'Honda', 'PCX 125', 'Scooter', 9800, 'État neuf', 2023, 1200, 125, 'Noir',
   'Sfax', 'Sfax',
   ARRAY['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200'],
   ARRAY['ABS','Coffre','Démarrage sans clé'],
   'active', TRUE, 2, NOW() - INTERVAL '1 day', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'Kawasaki Z900 2021',
   'Z900 en très bon état, sortie d''échappement Akrapovic, contrôle technique OK.',
   'Kawasaki', 'Z900', 'Moto', 34000, 'Très bon', 2021, 14500, 948, 'Vert',
   'Sousse', 'Sousse',
   ARRAY['https://images.unsplash.com/photo-1635073908681-b4dfb7d2db2d?w=1200'],
   ARRAY['ABS','Quickshifter','LED'],
   'active', FALSE, 2, NOW() - INTERVAL '5 days', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'BMW R 1250 GS Adventure',
   'GS Adventure full options, parfaite pour le voyage. Valises, pare-brise haut, protections.',
   'BMW', 'R 1250 GS', 'Moto', 78000, 'Excellent', 2022, 22000, 1254, 'Blanc',
   'Tunis', 'Tunis',
   ARRAY['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'],
   ARRAY['ABS','Régulateur','Chauffage poignées','Valises','GPS'],
   'active', TRUE, 1, NOW() - INTERVAL '3 days', NOW() + INTERVAL '60 days'),

  ('33333333-3333-3333-3333-333333333333',
   'Vespa GTS 300 Super',
   'Vespa GTS 300 Super, finition impeccable, peinture d''origine. Idéal collectionneur.',
   'Vespa', 'GTS 300', 'Scooter', 18500, 'Excellent', 2020, 9800, 278, 'Rouge',
   'Nabeul', 'Nabeul',
   ARRAY['https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=1200'],
   ARRAY['ABS','Top case','Selle bi-place'],
   'active', FALSE, 2, NOW() - INTERVAL '10 days', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'KTM Duke 390 — 2023',
   'Duke 390 quasi-neuve, encore sous garantie. Idéale jeune permis A2.',
   'KTM', 'Duke 390', 'Moto', 21000, 'État neuf', 2023, 3200, 373, 'Orange',
   'Bizerte', 'Bizerte',
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','Quickshifter','TFT couleur'],
   'active', FALSE, 2, NOW() - INTERVAL '7 days', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'Ducati Monster 821',
   'Monster 821 entretenue chez Ducati. Échappement Termignoni, sabot moteur.',
   'Ducati', 'Monster 821', 'Moto', 32000, 'Très bon', 2019, 18500, 821, 'Rouge',
   'Tunis', 'Tunis',
   ARRAY['https://images.unsplash.com/photo-1580310614729-ccd69652491d?w=1200'],
   ARRAY['ABS','Riding modes','LED'],
   'active', FALSE, 2, NOW() - INTERVAL '12 days', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'Suzuki GSX-R 600',
   'GSX-R 600 sportive en bon état, pneus récents, révision faite.',
   'Suzuki', 'GSX-R 600', 'Moto', 19500, 'Bon', 2017, 28000, 599, 'Bleu',
   'Sfax', 'Sfax',
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','LED','Sabot'],
   'active', FALSE, 1, NOW() - INTERVAL '15 days', NOW() + INTERVAL '60 days'),

  ('33333333-3333-3333-3333-333333333333',
   'Piaggio Liberty 125',
   'Scooter Piaggio Liberty 125, faible kilométrage, parfait pour la ville.',
   'Piaggio', 'Liberty 125', 'Scooter', 5800, 'Bon', 2019, 18000, 125, 'Blanc',
   'Tunis', 'Tunis',
   ARRAY['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200'],
   ARRAY['Coffre','Top case'],
   'active', FALSE, 2, NOW() - INTERVAL '4 days', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'Harley-Davidson Iron 883',
   'Sportster Iron 883, look custom, sacoches latérales, pot Vance & Hines.',
   'Harley-Davidson', 'Iron 883', 'Moto', 42000, 'Très bon', 2018, 21000, 883, 'Noir',
   'Hammamet', 'Nabeul',
   ARRAY['https://images.unsplash.com/photo-1558980664-1db506751c0c?w=1200'],
   ARRAY['Sacoches','Pot sport','Selle solo'],
   'active', TRUE, 1, NOW() - INTERVAL '6 days', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'Yamaha Tmax 530',
   'Tmax 530 DX, full options, équipé pour tourer. Carnet d''entretien complet.',
   'Yamaha', 'Tmax 530', 'Scooter', 24500, 'Excellent', 2020, 16000, 530, 'Gris',
   'Tunis', 'Tunis',
   ARRAY['https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200'],
   ARRAY['ABS','Régulateur','Chauffage poignées','Top case'],
   'active', FALSE, 3, NOW() - INTERVAL '8 days', NOW() + INTERVAL '60 days'),

  ('22222222-2222-2222-2222-222222222222',
   'Royal Enfield Classic 350',
   'Classic 350 neuve, peinture noir mat. Style rétro intemporel.',
   'Royal Enfield', 'Classic 350', 'Moto', 16500, 'État neuf', 2023, 850, 349, 'Noir',
   'Monastir', 'Monastir',
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['ABS','LED'],
   'active', FALSE, 2, NOW() - INTERVAL '2 days', NOW() + INTERVAL '60 days')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- GARAGES — 6 sample shops across Tunisia
-- =====================================================================
INSERT INTO garages (
  owner_id, name, description, address, city, governorate, phone, email, website,
  image, images, specialties, latitude, longitude, rating, reviews_count, is_verified, hours
) VALUES
  ('33333333-3333-3333-3333-333333333333',
   'MotoCenter Tunis',
   'Spécialiste mécanique sportive et entretien toutes marques depuis 2010.',
   '12 Avenue Habib Bourguiba', 'Tunis', 'Tunis',
   '+216 71 234 567', 'contact@motocenter.tn', 'https://motocenter.tn',
   'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200',
   ARRAY['https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200','https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'],
   ARRAY['Mécanique','Pneumatiques','Carrosserie'],
   36.8065, 10.1815, 4.7, 24, TRUE,
   'Lun-Ven: 8h-18h | Sam: 9h-13h'),

  (NULL,
   'Scoot Express Sousse',
   'Vente, entretien et réparation scooters Piaggio, Vespa, Honda.',
   '45 Avenue Léopold Sénghor', 'Sousse', 'Sousse',
   '+216 73 456 789', 'info@scootexpress.tn', NULL,
   'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=1200',
   ARRAY['https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=1200'],
   ARRAY['Scooters','Vente','Pièces détachées'],
   35.8245, 10.6346, 4.4, 18, TRUE,
   'Lun-Sam: 8h30-19h'),

  (NULL,
   'Garage des Champions Sfax',
   'Préparation moto sportive, customisation et tuning. Champions du circuit.',
   'Route de Mahdia km 5', 'Sfax', 'Sfax',
   '+216 74 678 901', 'contact@champions-moto.tn', 'https://champions-moto.tn',
   'https://images.unsplash.com/photo-1623057921892-0a35a01c6b97?w=1200',
   ARRAY['https://images.unsplash.com/photo-1623057921892-0a35a01c6b97?w=1200'],
   ARRAY['Préparation','Tuning','Compétition'],
   34.7406, 10.7603, 4.9, 31, TRUE,
   'Lun-Ven: 9h-19h | Sam: 9h-14h'),

  (NULL,
   'BMW Motorrad Tunis',
   'Concessionnaire officiel BMW Motorrad. Vente neuf et occasion, entretien constructeur.',
   'Route de la Marsa km 8', 'Tunis', 'Tunis',
   '+216 71 890 123', 'service@bmw-motorrad.tn', 'https://bmw-motorrad.tn',
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   ARRAY['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'],
   ARRAY['Concessionnaire BMW','Garantie constructeur','Pièces d''origine'],
   36.8782, 10.3247, 4.8, 42, TRUE,
   'Lun-Ven: 9h-18h30 | Sam: 9h-13h'),

  (NULL,
   'Atelier Vintage Bizerte',
   'Restauration motos anciennes et collection. Spécialiste pièces d''époque.',
   '8 Rue de la République', 'Bizerte', 'Bizerte',
   '+216 72 345 678', 'vintage@atelier-bizerte.tn', NULL,
   'https://images.unsplash.com/photo-1558980664-1db506751c0c?w=1200',
   ARRAY['https://images.unsplash.com/photo-1558980664-1db506751c0c?w=1200'],
   ARRAY['Restauration','Pièces vintage','Collection'],
   37.2744, 9.8739, 4.6, 12, FALSE,
   'Lun-Sam: 9h-17h'),

  (NULL,
   'Pneus Express Nabeul',
   'Spécialiste pneumatiques moto et scooter. Montage, équilibrage, parallélisme.',
   '120 Avenue Habib Thameur', 'Nabeul', 'Nabeul',
   '+216 72 567 890', 'contact@pneus-express.tn', NULL,
   'https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=1200',
   ARRAY['https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=1200'],
   ARRAY['Pneumatiques','Montage rapide'],
   36.4561, 10.7376, 4.3, 9, FALSE,
   'Lun-Sam: 8h-19h')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- ARTICLES — 6 published articles across categories
-- =====================================================================
INSERT INTO articles (
  author_id, title, slug, summary, content, category, image, tags,
  is_featured, is_published, read_time, published_at
) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'Yamaha dévoile la nouvelle MT-09 2025',
   'yamaha-mt-09-2025',
   'La nouvelle Yamaha MT-09 2025 arrive avec un moteur revisité, un nouveau design et une électronique de pointe.',
   '<p>Yamaha vient de présenter officiellement la nouvelle MT-09 2025, héritière directe du roadster star de la marque. Au programme : un moteur CP3 de 890 cm³ retravaillé pour gagner en couple, un nouveau cadre allégé, et un pack électronique complet incluant IMU 6 axes, contrôle de traction, anti-wheelie et quickshifter bidirectionnel de série.</p><p>Le design s''affine avec un nouveau phare LED en deux parties et un réservoir plus sculpté. Disponible en trois coloris dès mars 2025.</p>',
   'Nouveautés',
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   ARRAY['Yamaha','Roadster','Nouveauté 2025'],
   TRUE, TRUE, '4', NOW() - INTERVAL '3 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Essai Honda CB650R 2024 : la néo-rétro qui séduit',
   'essai-honda-cb650r-2024',
   'Nous avons testé la Honda CB650R 2024 sur route et autoroute. Verdict.',
   '<p>La CB650R reste fidèle à la philosophie Neo Sports Café de Honda. Sur route, le 4-cylindres en ligne de 649 cm³ développe 95 ch et offre une sonorité enchanteresse à partir de 7 000 tr/min.</p><p>Confortable en duo, agile en ville, à l''aise sur autoroute : la CB650R fait tout très bien sans jamais exceller. Une moto polyvalente qui mérite ses 9 700 € tarif clé en main.</p>',
   'Essais',
   'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200',
   ARRAY['Honda','Essai','Néo-rétro'],
   FALSE, TRUE, '6', NOW() - INTERVAL '7 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Les meilleurs scooters électriques 2024',
   'meilleurs-scooters-electriques-2024',
   'Top 5 des scooters électriques à acheter cette année : autonomie, prix, performances.',
   '<p>L''électrique s''impose progressivement sur le segment des deux-roues urbains. Voici notre sélection des modèles les plus aboutis : Niu MQi GT Evo, Super Soco CPx, Silence S01, Vespa Elettrica et BMW CE 04.</p><p>Avec des autonomies allant de 80 à 130 km et des prix compris entre 3 000 € et 12 000 €, il y en a pour tous les usages.</p>',
   'Électrique',
   'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200',
   ARRAY['Électrique','Scooter','Top 5'],
   TRUE, TRUE, '5', NOW() - INTERVAL '14 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Comprendre le freinage ABS et le contrôle de traction',
   'abs-controle-traction-explication',
   'Tout savoir sur les aides à la conduite modernes : ABS, TC, IMU.',
   '<p>L''ABS (Anti-lock Braking System) empêche le blocage des roues lors d''un freinage d''urgence. Le contrôle de traction (TC) limite la perte d''adhérence à l''accélération. La centrale inertielle IMU 6 axes mesure les mouvements de la moto et permet une gestion en angle de ces aides.</p>',
   'Tech',
   'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200',
   ARRAY['Sécurité','ABS','Tech'],
   FALSE, TRUE, '7', NOW() - INTERVAL '20 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Vespa GTS 310 : la légende italienne se modernise',
   'vespa-gts-310-2024',
   'La nouvelle Vespa GTS 310 reçoit un nouveau moteur Euro 5+ et un dashboard digital.',
   '<p>Piaggio renouvelle son scooter haut de gamme avec un moteur HPE de 310 cm³ développant 26 ch. Nouveau dashboard TFT 4.3", connectivité smartphone, ABS deux canaux et contrôle de traction de série.</p>',
   'Scooters',
   'https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=1200',
   ARRAY['Vespa','Scooter','Nouveauté'],
   FALSE, TRUE, '4', NOW() - INTERVAL '25 days'),

  ('11111111-1111-1111-1111-111111111111',
   'BMW CE 04 : le scooter électrique du futur',
   'bmw-ce-04-essai',
   'Essai du scooter électrique BMW CE 04 : design futuriste, autonomie réelle, conduite.',
   '<p>Le CE 04 affirme un design radical et une technologie de pointe. Moteur électrique 42 ch, autonomie réelle de 110 km en cycle mixte, recharge rapide en 1h40. Un OVNI urbain à 12 500 €.</p>',
   'Électrique',
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   ARRAY['BMW','Électrique','Essai'],
   FALSE, TRUE, '6', NOW() - INTERVAL '30 days')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- TIPS — 6 published practical tips
-- =====================================================================
INSERT INTO tips (
  author_id, title, slug, summary, content, category, difficulty, tools, image,
  read_time, is_published, published_at
) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'Comment vérifier la pression de vos pneus',
   'verifier-pression-pneus',
   'Une pression correcte garantit votre sécurité et la durée de vie de vos pneus.',
   '<p>Vérifiez la pression à froid au moins une fois par mois. Reportez-vous au manuel ou à l''étiquette sur le bras oscillant. Une pression trop basse use les flancs ; trop élevée, c''est le centre qui souffre et la tenue de route se dégrade.</p>',
   'Entretien', 'Débutant',
   ARRAY['Manomètre','Compresseur'],
   'https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=1200',
   '3', TRUE, NOW() - INTERVAL '2 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Bien choisir son casque moto',
   'bien-choisir-son-casque',
   'Intégral, modulable, jet : guide complet pour choisir le bon casque selon votre pratique.',
   '<p>Pour la route, privilégiez un casque intégral homologué ECE 22.06. Mesurez votre tour de tête, essayez plusieurs marques (les morphologies varient), et n''économisez pas sur cet équipement vital.</p>',
   'Équipement', 'Débutant',
   ARRAY['Mètre ruban'],
   'https://images.unsplash.com/photo-1591637333472-cd9eb13e8e09?w=1200',
   '5', TRUE, NOW() - INTERVAL '5 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Faire la vidange de sa moto soi-même',
   'faire-vidange-soi-meme',
   'Étape par étape : changer son huile et son filtre à huile en moins d''une heure.',
   '<p>Faites tourner le moteur 5 min pour fluidifier l''huile. Placez un bac, dévissez le bouchon de vidange, laissez s''écouler. Changez le joint, remplacez le filtre, refaites le plein avec l''huile préconisée.</p>',
   'Entretien', 'Intermédiaire',
   ARRAY['Clé à filtre','Bac de vidange','Huile','Filtre'],
   'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200',
   '8', TRUE, NOW() - INTERVAL '10 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Conduire sous la pluie : 7 conseils essentiels',
   'conduire-sous-la-pluie',
   'Anticipation, freinage, trajectoires : maîtrisez la conduite par temps humide.',
   '<p>Réduisez votre vitesse de 30%, augmentez les distances, évitez les bandes blanches et les plaques d''égout. Freinez tôt et progressivement, privilégiez le frein arrière. Évitez les angles importants.</p>',
   'Conduite', 'Intermédiaire',
   ARRAY['Équipement étanche'],
   'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
   '6', TRUE, NOW() - INTERVAL '15 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Régler la chaîne de transmission',
   'regler-chaine-transmission',
   'Une chaîne bien tendue et bien lubrifiée, c''est la clé d''une transmission qui dure.',
   '<p>Mesurez la flèche au milieu du brin inférieur (généralement 25-35 mm). Desserrez l''écrou d''axe, ajustez les tendeurs symétriquement, resserrez au couple. Lubrifiez après chaque sortie sous la pluie.</p>',
   'Entretien', 'Intermédiaire',
   ARRAY['Clé à pipe','Spray chaîne','Réglet'],
   'https://images.unsplash.com/photo-1623057921892-0a35a01c6b97?w=1200',
   '7', TRUE, NOW() - INTERVAL '20 days'),

  ('11111111-1111-1111-1111-111111111111',
   'Que dit la loi sur le port des gants moto ?',
   'loi-gants-moto',
   'Depuis 2016, les gants homologués sont obligatoires en France pour tout deux-roues.',
   '<p>Les gants doivent porter le marquage CE et être adaptés au deux-roues motorisé. L''absence de gants conformes peut entraîner une amende de 68 € et le retrait d''un point.</p>',
   'Législation', 'Débutant',
   ARRAY[]::TEXT[],
   'https://images.unsplash.com/photo-1591637333472-cd9eb13e8e09?w=1200',
   '3', TRUE, NOW() - INTERVAL '25 days')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- FAQ
-- =====================================================================
INSERT INTO faqs (question, answer, category, position, is_published)
VALUES
  ('Comment publier une annonce ?',
   'Cliquez sur "Déposer une annonce" en haut de la page, remplissez les étapes (catégorie, technique, équipement, photos, publication) et validez. Votre annonce sera mise en ligne après modération.',
   'Annonces', 1, TRUE),
  ('Combien de temps reste mon annonce en ligne ?',
   'Une annonce reste publiée 60 jours par défaut. Vous pouvez la prolonger ou la booster depuis votre tableau de bord.',
   'Annonces', 2, TRUE),
  ('Comment contacter un vendeur ?',
   'Sur la page de l''annonce, utilisez les boutons Appeler, WhatsApp ou Message pour entrer en contact directement avec le vendeur.',
   'Acheter', 1, TRUE),
  ('Comment signaler une annonce frauduleuse ?',
   'Cliquez sur l''icône drapeau en haut de l''annonce, sélectionnez la raison (spam, fraude, contenu inapproprié, etc.) et envoyez. Notre équipe vérifiera sous 24h.',
   'Sécurité', 1, TRUE),
  ('Le service est-il gratuit ?',
   'Oui, la création de compte et la publication d''annonces standard sont entièrement gratuites. Des options payantes (boost, mise en avant) sont disponibles pour plus de visibilité.',
   'Général', 1, TRUE),
  ('Comment supprimer mon compte ?',
   'Rendez-vous dans Mon compte > Paramètres > Supprimer le compte. La suppression est définitive et entraîne la perte de toutes vos annonces et messages.',
   'Compte', 1, TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- SITE REVIEWS — testimonials
-- =====================================================================
INSERT INTO site_reviews (user_id, name, rating, content, is_published)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'Karim B.', 5,
   'Vendu ma moto en moins d''une semaine, plateforme très simple à utiliser.', TRUE),
  (NULL, 'Sonia M.', 5,
   'Excellente expérience d''achat, j''ai trouvé exactement le scooter que je cherchais.', TRUE),
  (NULL, 'Mehdi T.', 4,
   'Bonne plateforme, beaucoup d''annonces de qualité. Le système de messagerie est top.', TRUE),
  (NULL, 'Amira L.', 5,
   'Service client très réactif, équipe à l''écoute. Je recommande !', TRUE),
  (NULL, 'Walid F.', 4,
   'Site bien fait, navigation fluide sur mobile. Quelques annonces obsolètes parfois.', TRUE),
  (NULL, 'Hela S.', 5,
   'Trouvé mon premier scooter ici. Vendeur sérieux, transaction parfaite.', TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- AD CAMPAIGNS — sample ads (active for 90 days)
-- =====================================================================
INSERT INTO ad_campaigns (
  title, client, zone, description, media_type, media_url, link_url, cta_text,
  start_date, end_date, is_active
) VALUES
  ('Promo Casques Shoei -20%', 'Shoei Tunisia', 'home_banner',
   'Toute la gamme Shoei à -20% jusqu''à fin du mois.',
   'Image', 'https://images.unsplash.com/photo-1591637333472-cd9eb13e8e09?w=1600',
   'https://example.com/shoei', 'Découvrir',
   CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '85 days', TRUE),

  ('Assurance Moto Allianz', 'Allianz', 'search_sidebar',
   'Assurez votre moto avec Allianz, devis en 2 minutes.',
   'Image', 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=800',
   'https://example.com/allianz', 'Obtenir un devis',
   CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '80 days', TRUE),

  ('Pneus Michelin Road 6', 'Michelin', 'listing_sidebar',
   'Le nouveau Michelin Road 6, 15% d''adhérence en plus sur sol mouillé.',
   'Image', 'https://images.unsplash.com/photo-1525160354320-d8e92641c563?w=800',
   'https://example.com/michelin', 'En savoir plus',
   CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '60 days', TRUE),

  ('Permis Moto Express', 'Auto-École Pro', 'news_top',
   'Obtenez votre permis A2 en 4 semaines, formation accélérée.',
   'Image', 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1600',
   'https://example.com/permis', 'S''inscrire',
   CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '90 days', TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- TECH SPECS — sample motorcycle technical sheets
-- =====================================================================
INSERT INTO tech_specs (
  brand, model, year, category, price_new, image, gallery,
  engine, chassis, electronics, dimensions, consumption, top_speed
) VALUES
  ('Yamaha', 'MT-07', 2024, 'Roadster', '8 199 €',
   'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200',
   ARRAY['https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200'],
   '{"type":"Bicylindre en ligne","cylindree":"689 cm³","puissance":"73,4 ch à 8 750 tr/min","couple":"67 Nm à 6 500 tr/min"}'::jsonb,
   '{"cadre":"Diamant tubulaire acier","fourche":"Téléhydraulique 41 mm","freinAvant":"Double disque 282 mm","freinArriere":"Disque 245 mm"}'::jsonb,
   '{"abs":"Oui","tractionControl":"Non","modes":"Non"}'::jsonb,
   '{"longueur":"2085 mm","largeur":"780 mm","poids":"184 kg","reservoir":"14 L"}'::jsonb,
   '4,2 L/100km', '210 km/h'),

  ('Honda', 'CB650R', 2024, 'Roadster', '9 699 €',
   'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200',
   ARRAY['https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'],
   '{"type":"4 cylindres en ligne","cylindree":"649 cm³","puissance":"95 ch à 12 000 tr/min","couple":"63 Nm à 9 500 tr/min"}'::jsonb,
   '{"cadre":"Treillis acier","fourche":"Showa SFF-BP 41 mm","freinAvant":"Double disque 310 mm","freinArriere":"Disque 240 mm"}'::jsonb,
   '{"abs":"Oui","tractionControl":"Oui (HSTC)","modes":"Non"}'::jsonb,
   '{"longueur":"2130 mm","largeur":"780 mm","poids":"202 kg","reservoir":"15,4 L"}'::jsonb,
   '5,6 L/100km', '230 km/h'),

  ('Kawasaki', 'Z900', 2024, 'Roadster', '10 199 €',
   'https://images.unsplash.com/photo-1635073908681-b4dfb7d2db2d?w=1200',
   ARRAY['https://images.unsplash.com/photo-1635073908681-b4dfb7d2db2d?w=1200'],
   '{"type":"4 cylindres en ligne","cylindree":"948 cm³","puissance":"125 ch à 9 500 tr/min","couple":"98,6 Nm à 7 700 tr/min"}'::jsonb,
   '{"cadre":"Treillis acier","fourche":"Inversée 41 mm","freinAvant":"Double disque 300 mm","freinArriere":"Disque 250 mm"}'::jsonb,
   '{"abs":"Oui","tractionControl":"Oui (KTRC)","modes":"4 modes"}'::jsonb,
   '{"longueur":"2070 mm","largeur":"825 mm","poids":"212 kg","reservoir":"17 L"}'::jsonb,
   '5,8 L/100km', '240 km/h')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- Update aggregate counters so feeds order naturally
-- =====================================================================
UPDATE listings SET views_count = floor(random() * 500 + 50)::int,
                    favorites_count = floor(random() * 30)::int
WHERE views_count = 0;

UPDATE articles SET views_count = floor(random() * 2000 + 200)::int,
                    likes_count = floor(random() * 80)::int
WHERE views_count = 0;

UPDATE tips SET views_count = floor(random() * 1500 + 100)::int,
                likes_count = floor(random() * 60)::int
WHERE views_count = 0;
